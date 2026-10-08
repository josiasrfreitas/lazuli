import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStaffAccess } from "@lazuli/auth";
import type { StaffRole } from "@lazuli/auth";

import { ROLE_MATRIX } from "@lazuli/api";

const ALL_ROLES = Object.keys(ROLE_MATRIX) as StaffRole[];

function isEnabledByAuth(role: StaffRole): boolean {
  return evaluateStaffAccess({ email: "probe@example.com", role, isEnabled: true }).allowed;
}

function reachesAnyRouter(role: StaffRole): boolean {
  return Object.values(ROLE_MATRIX[role]).some((access) => access !== "none");
}

void describe("ROLE_MATRIX stays aligned with the enabled-staff gate (D-0016)", () => {
  void it("roles reachable in the matrix are exactly the roles auth enables", () => {
    const enabledByAuth = ALL_ROLES.filter((role) => isEnabledByAuth(role));
    const reachableInMatrix = ALL_ROLES.filter((role) => reachesAnyRouter(role));

    // Both are filtered from ALL_ROLES in order, so equal order <=> equal set.
    assert.deepEqual(reachableInMatrix, enabledByAuth);
  });
});
