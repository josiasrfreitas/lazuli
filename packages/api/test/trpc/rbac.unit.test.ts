import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import {
  adminProcedure,
  assertResourceScope,
  canAccess,
  createCallerFactory,
  router,
  routerAccess,
  staffProcedure,
  teacherProcedure,
} from "@lazuli/api";
import type { Context, RouterAccess, RouterName, StaffUser } from "@lazuli/api";

const ALL_ROUTERS: readonly RouterName[] = [
  "users",
  "students",
  "catalog",
  "classes",
  "calendar",
  "enrollment",
  "attendance",
  "portal",
  "finance",
  "reports",
  "dashboard",
];

const FORBIDDEN = "FORBIDDEN" as const;
const UNAUTHORIZED = "UNAUTHORIZED" as const;
const ANOTHER_TEACHER = "another-teacher";

/** Matches a thrown TRPCError carrying the given code (FORBIDDEN -> HTTP 403). */
function isTRPCError(code: TRPCError["code"]): (error: unknown) => boolean {
  return (error) => error instanceof TRPCError && error.code === code;
}

const ADMIN: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ad",
  name: "Admin de Teste",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};
const TEACHER: StaffUser = {
  id: "00000000-0000-0000-0000-0000000000ed",
  name: "Professora de Teste",
  email: "teacher@example.com",
  role: "TEACHER",
  isEnabled: true,
};

/** RBAC gating never touches the database, so a typed empty stand-in is enough. */
function contextFor(staffUser: StaffUser | null): Context {
  return { db: {} as Context["db"], staffUser };
}

const testRouter = router({
  adminOnly: adminProcedure.query(() => "ok" as const),
  teacherOnly: teacherProcedure.query(() => "ok" as const),
  anyStaff: staffProcedure.query(() => "ok" as const),

  // Shared-router procedures that load an owning resource, then guard it — the real
  // pattern a future `classes`/`attendance` resolver will follow (§5.2).
  classOwnedByTeacher: staffProcedure.query(({ ctx }) => {
    const loaded = { id: "class-owned", teacherId: TEACHER.id };
    assertResourceScope(ctx.staffUser, loaded);
    return loaded;
  }),
  classOwnedByAnother: staffProcedure.query(({ ctx }) => {
    const loaded = { id: "class-foreign", teacherId: ANOTHER_TEACHER };
    assertResourceScope(ctx.staffUser, loaded);
    return loaded;
  }),
});
const callerFor = createCallerFactory(testRouter);

void describe("adminProcedure role gate", () => {
  void it("allows ADMIN", async () => {
    assert.equal(await callerFor(contextFor(ADMIN)).adminOnly(), "ok");
  });

  void it("rejects TEACHER with FORBIDDEN", async () => {
    await assert.rejects(callerFor(contextFor(TEACHER)).adminOnly(), isTRPCError(FORBIDDEN));
  });
});

void describe("teacherProcedure role gate", () => {
  void it("allows TEACHER", async () => {
    assert.equal(await callerFor(contextFor(TEACHER)).teacherOnly(), "ok");
  });

  void it("rejects ADMIN with FORBIDDEN", async () => {
    await assert.rejects(callerFor(contextFor(ADMIN)).teacherOnly(), isTRPCError(FORBIDDEN));
  });
});

void describe("staffProcedure role gate", () => {
  void it("allows both ADMIN and TEACHER", async () => {
    assert.equal(await callerFor(contextFor(ADMIN)).anyStaff(), "ok");
    assert.equal(await callerFor(contextFor(TEACHER)).anyStaff(), "ok");
  });
});

void describe("role gates reject anonymous callers", () => {
  void it("returns UNAUTHORIZED before any role check", async () => {
    const anon = callerFor(contextFor(null));
    await assert.rejects(anon.adminOnly(), isTRPCError(UNAUTHORIZED));
    await assert.rejects(anon.teacherOnly(), isTRPCError(UNAUTHORIZED));
    await assert.rejects(anon.anyStaff(), isTRPCError(UNAUTHORIZED));
  });
});

void describe("assertResourceScope teacher guard", () => {
  void it("lets ADMIN through regardless of owner", () => {
    assert.doesNotThrow(() => assertResourceScope(ADMIN, { teacherId: ANOTHER_TEACHER }));
  });

  void it("lets a TEACHER reach a resource they own", () => {
    assert.doesNotThrow(() => assertResourceScope(TEACHER, { teacherId: TEACHER.id }));
  });

  void it("rejects a TEACHER reaching a resource owned by another with FORBIDDEN", () => {
    assert.throws(
      () => assertResourceScope(TEACHER, { teacherId: ANOTHER_TEACHER }),
      isTRPCError(FORBIDDEN),
    );
  });
});

void describe("teacher resource scope through a tRPC procedure", () => {
  void it("lets a TEACHER read a class they own", async () => {
    const result = await callerFor(contextFor(TEACHER)).classOwnedByTeacher();
    assert.equal(result.teacherId, TEACHER.id);
  });

  void it("rejects a TEACHER reading a class owned by another with FORBIDDEN", async () => {
    await assert.rejects(
      callerFor(contextFor(TEACHER)).classOwnedByAnother(),
      isTRPCError(FORBIDDEN),
    );
  });

  void it("lets ADMIN read any class regardless of owner", async () => {
    const result = await callerFor(contextFor(ADMIN)).classOwnedByAnother();
    assert.equal(result.teacherId, ANOTHER_TEACHER);
  });
});

void describe("ROLE_MATRIX encodes the §5.2 RBAC matrix", () => {
  void it("grants ADMIN full access to every router", () => {
    for (const name of ALL_ROUTERS) {
      assert.equal(routerAccess("ADMIN", name), "full", name);
    }
  });

  void it("scopes TEACHER to owned-resource routers and denies admin-only routers", () => {
    const expected: readonly (readonly [RouterName, RouterAccess])[] = [
      ["users", "none"],
      ["students", "scoped"],
      ["catalog", "scoped"],
      ["classes", "scoped"],
      ["calendar", "scoped"],
      ["enrollment", "scoped"],
      ["attendance", "scoped"],
      ["portal", "none"],
      ["finance", "none"],
      ["reports", "scoped"],
      ["dashboard", "scoped"],
    ];
    for (const [name, access] of expected) {
      assert.equal(routerAccess("TEACHER", name), access, name);
    }
  });

  void it("denies the deferred SECRETARY and FINANCE roles everywhere (D-0016)", () => {
    for (const role of ["SECRETARY", "FINANCE"] as const) {
      for (const name of ALL_ROUTERS) {
        assert.equal(routerAccess(role, name), "none", `${role}.${name}`);
        assert.equal(canAccess(role, name), false, `${role}.${name}`);
      }
    }
  });

  void it("canAccess is true exactly when access is not none", () => {
    assert.equal(canAccess("ADMIN", "finance"), true);
    assert.equal(canAccess("TEACHER", "attendance"), true);
    assert.equal(canAccess("TEACHER", "finance"), false);
  });
});
