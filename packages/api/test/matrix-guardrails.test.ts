import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStaffAccess } from "@lazuli/auth";
import type { StaffRole } from "@lazuli/auth";

import {
  adminProcedure,
  createCallerFactory,
  router,
  routerAccess,
  staffProcedure,
} from "@lazuli/api";

import { ALL_ROUTERS, assertRouterGating, contextFor } from "./support.js";

const ALL_ROLES: readonly StaffRole[] = ["ADMIN", "SECRETARY", "TEACHER", "FINANCE"];

function isEnabledByAuth(role: StaffRole): boolean {
  return evaluateStaffAccess({ email: "probe@example.com", role, isEnabled: true }).allowed;
}

function reachesAnyRouter(role: StaffRole): boolean {
  return ALL_ROUTERS.some((name) => routerAccess(role, name) !== "none");
}

void describe("ROLE_MATRIX stays aligned with the enabled-staff gate (D-0016)", () => {
  void it("roles reachable in the matrix are exactly the roles auth enables", () => {
    const enabledByAuth = ALL_ROLES.filter((role) => isEnabledByAuth(role));
    const reachableInMatrix = ALL_ROLES.filter((role) => reachesAnyRouter(role));

    // Both are filtered from ALL_ROLES in order, so equal order <=> equal set.
    assert.deepEqual(reachableInMatrix, enabledByAuth);
  });
});

void describe("assertRouterGating catches gate/matrix drift", () => {
  // A faithfully-gated slice of the app: ADMIN-only finance, ADMIN+TEACHER students.
  const goodRouter = router({
    finance: router({ overdueList: adminProcedure.query(() => "ok" as const) }),
    students: router({ search: staffProcedure.query(() => "ok" as const) }),
  });
  const goodCaller = createCallerFactory(goodRouter);

  void it("passes when each router's gate matches the matrix", async () => {
    await assertRouterGating({
      router: "finance",
      invoke: (staffUser) => goodCaller(contextFor(staffUser)).finance.overdueList(),
    });
    await assertRouterGating({
      router: "students",
      invoke: (staffUser) => goodCaller(contextFor(staffUser)).students.search(),
    });
  });

  void it("fails when a teacher-denied router is mounted with a shared gate", async () => {
    // Drift: finance must be ADMIN-only, but this mounts it on staffProcedure, so a
    // TEACHER would reach it — contradicting `routerAccess("TEACHER", "finance") === "none"`.
    const driftedRouter = router({ wrong: staffProcedure.query(() => "ok" as const) });
    const driftedCaller = createCallerFactory(driftedRouter);

    await assert.rejects(
      assertRouterGating({
        router: "finance",
        invoke: (staffUser) => driftedCaller(contextFor(staffUser)).wrong(),
      }),
    );
  });
});
