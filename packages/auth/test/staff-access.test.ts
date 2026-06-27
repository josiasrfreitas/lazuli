import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateStaffAccess } from "../src/staff-access.js";

const UNAUTHORIZED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

void describe("pre-provisioned staff access", () => {
  void it("allows enabled staff in the MVP role set to authenticate", () => {
    const result = evaluateStaffAccess({
      email: "teacher@example.com",
      role: "TEACHER",
      isEnabled: true,
    });

    assert.deepEqual(result, { allowed: true });
  });

  void it("rejects an email with no pre-provisioned staff user", () => {
    const result = evaluateStaffAccess(null);

    assert.deepEqual(result, {
      allowed: false,
      reason: "UNKNOWN_EMAIL",
      message: UNAUTHORIZED_MESSAGE,
    });
  });

  void it("rejects disabled staff users", () => {
    const result = evaluateStaffAccess({
      email: "disabled@example.com",
      role: "ADMIN",
      isEnabled: false,
    });

    assert.deepEqual(result, {
      allowed: false,
      reason: "DISABLED_USER",
      message: UNAUTHORIZED_MESSAGE,
    });
  });

  void it("rejects deferred roles until they are enabled after MVP", () => {
    const result = evaluateStaffAccess({
      email: "finance@example.com",
      role: "FINANCE",
      isEnabled: true,
    });

    assert.deepEqual(result, {
      allowed: false,
      reason: "ROLE_NOT_ENABLED",
      message: UNAUTHORIZED_MESSAGE,
    });
  });
});
