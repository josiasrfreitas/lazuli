import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateStaffAccess,
  isStaffAccessDeniedCode,
  STAFF_ACCESS_DENIED_CODE,
  STAFF_ACCESS_DENIED_MESSAGE,
} from "../src/staff-access.js";

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
      message: STAFF_ACCESS_DENIED_MESSAGE,
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
      message: STAFF_ACCESS_DENIED_MESSAGE,
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
      message: STAFF_ACCESS_DENIED_MESSAGE,
    });
  });

  void it("reads our denial code and Better Auth's signup_disabled as access denied", () => {
    assert.equal(isStaffAccessDeniedCode(STAFF_ACCESS_DENIED_CODE), true);
    assert.equal(isStaffAccessDeniedCode("signup_disabled"), true);
  });

  void it("does not read verification failures as access denied", () => {
    assert.equal(isStaffAccessDeniedCode("INVALID_TOKEN"), false);
  });
});
