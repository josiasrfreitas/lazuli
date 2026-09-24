import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import {
  adminProcedure,
  assertResourceScope,
  canAccess,
  createCallerFactory,
  router,
  staffProcedure,
  systemAdminProcedure,
  teacherProcedure,
} from "@lazuli/api";
import type { Context, StaffUser } from "@lazuli/api";

const FORBIDDEN = "FORBIDDEN" as const;
const UNAUTHORIZED = "UNAUTHORIZED" as const;
const ANOTHER_TEACHER = "another-teacher";

/** Matches a thrown TRPCError carrying the given code (FORBIDDEN -> HTTP 403). */
function isTRPCError(code: TRPCError["code"]): (error: Error) => boolean {
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
const SYSTEM_ADMIN: StaffUser = { ...ADMIN, role: "SYSTEM_ADMIN" };

/** RBAC gating never touches the database, so a typed empty stand-in is enough. */
function contextFor(staffUser: StaffUser | null): Context {
  return { db: {} as Context["db"], staffUser };
}

const testRouter = router({
  settings: systemAdminProcedure.query(() => "settings" as const),
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

void describe("system settings role gate", () => {
  void it("allows SYSTEM_ADMIN and inherited administrative operations", async () => {
    const caller = callerFor(contextFor(SYSTEM_ADMIN));
    assert.equal(await caller.settings(), "settings");
    assert.equal(await caller.adminOnly(), "ok");
  });

  void it("denies ADMIN, TEACHER and guests", async () => {
    await assert.rejects(callerFor(contextFor(ADMIN)).settings(), isTRPCError(FORBIDDEN));
    await assert.rejects(callerFor(contextFor(TEACHER)).settings(), isTRPCError(FORBIDDEN));
    await assert.rejects(callerFor(contextFor(null)).settings(), isTRPCError(UNAUTHORIZED));
  });
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

void describe("canAccess", () => {
  void it("reports whether the matrix grants access", () => {
    assert.equal(canAccess("ADMIN", "finance"), true);
    assert.equal(canAccess("TEACHER", "attendance"), true);
    assert.equal(canAccess("TEACHER", "finance"), false);
  });
});
