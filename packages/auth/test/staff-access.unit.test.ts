import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateStaffAccess,
  isStaffAccessDeniedCode,
  resolveStaffIdentity,
} from "../src/staff-access.js";

const STAFF_ACCESS_DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

void describe("enabled staff access", () => {
  void it("allows an explicitly provisioned system administrator", () => {
    assert.deepEqual(
      evaluateStaffAccess({
        email: "system@example.com",
        role: "SYSTEM_ADMIN",
        isEnabled: true,
      }),
      { allowed: true },
    );
  });
  void it("allows enabled admins to authenticate", () => {
    const result = evaluateStaffAccess({
      email: "admin@example.com",
      role: "ADMIN",
      isEnabled: true,
    });

    assert.deepEqual(result, { allowed: true });
  });

  void it("allows enabled staff in the MVP role set to authenticate", () => {
    const result = evaluateStaffAccess({
      email: "teacher@example.com",
      role: "TEACHER",
      isEnabled: true,
    });

    assert.deepEqual(result, { allowed: true });
  });
});

void describe("pre-provisioned staff access denials", () => {
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
});

void describe("staff access denial codes", () => {
  void it("reads our denial code and Better Auth's signup_disabled as access denied", () => {
    assert.equal(isStaffAccessDeniedCode("STAFF_ACCESS_DENIED"), true);
    assert.equal(isStaffAccessDeniedCode("signup_disabled"), true);
  });

  void it("does not read verification failures as access denied", () => {
    assert.equal(isStaffAccessDeniedCode("INVALID_TOKEN"), false);
  });
});

void describe("staff identity resolution", () => {
  void it("selects only a provisioned role and removes teaching access on the departure date", () => {
    const user = {
      id: "admin-with-teaching-profile",
      name: "Coordenação docente",
      email: "teaching-admin@example.com",
      role: "ADMIN" as const,
      isEnabled: true,
      teacherProfile: { departureDate: new Date("2091-04-02") },
    };
    const now = new Date("2091-04-01T12:00:00Z");
    const teacher = resolveStaffIdentity(user, { now, requestedRole: "TEACHER" });
    assert.equal(teacher?.role, "TEACHER");
    assert.deepEqual(teacher?.roles, ["ADMIN", "TEACHER"]);
    const elevated = resolveStaffIdentity(user, { now, requestedRole: "SYSTEM_ADMIN" });
    assert.equal(elevated?.role, "ADMIN");
    const departed = resolveStaffIdentity(user, {
      now: new Date("2091-04-02T12:00:00Z"),
      requestedRole: "TEACHER",
    });
    assert.equal(departed?.role, "ADMIN");
    assert.deepEqual(departed?.roles, ["ADMIN"]);
  });
  void it("returns the domain identity for enabled staff", () => {
    const result = resolveStaffIdentity({
      id: "user-admin-1",
      name: "Coordenadora Admin",
      email: "admin.identity@example.com",
      role: "ADMIN",
      isEnabled: true,
    });

    assert.deepEqual(result, {
      id: "user-admin-1",
      name: "Coordenadora Admin",
      email: "admin.identity@example.com",
      role: "ADMIN",
      isEnabled: true,
      roles: ["ADMIN"],
    });
  });

  void it("returns null when no staff user was found", () => {
    const result = resolveStaffIdentity(null);

    assert.equal(result, null);
  });

  void it("returns null for disabled staff users", () => {
    const result = resolveStaffIdentity({
      id: "user-disabled-1",
      name: "Secretaria Desativada",
      email: "disabled.identity@example.com",
      role: "ADMIN",
      isEnabled: false,
    });

    assert.equal(result, null);
  });

  void it("returns null for staff roles not enabled for the MVP", () => {
    const result = resolveStaffIdentity({
      id: "user-finance-1",
      name: "Financeiro Pendente",
      email: "finance.identity@example.com",
      role: "FINANCE",
      isEnabled: true,
    });

    assert.equal(result, null);
  });
});
