export const STAFF_ACCESS_DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

/**
 * Machine-readable code carried by every staff-access denial, whatever the
 * underlying reason, so redirect handlers and the login screen can tell
 * "access denied" apart from other failures without ever exposing which of
 * the three denial reasons applied.
 */
export const STAFF_ACCESS_DENIED_CODE = "STAFF_ACCESS_DENIED";

/*
 * Better Auth's own error code when `disableSignUp` blocks a social sign-in
 * whose email has no `User` row. It short-circuits before our session hook
 * runs, so the denial arrives under this code instead of ours.
 */
const SOCIAL_SIGNUP_DISABLED_CODE = "signup_disabled";

/**
 * Whether a login error code means "this person is not allowed in". Every
 * staff account is pre-provisioned, so Better Auth's "signup disabled" is the
 * same denial as our own code, just raised earlier in the social flow.
 */
export function isStaffAccessDeniedCode(code: string): boolean {
  return code === STAFF_ACCESS_DENIED_CODE || code === SOCIAL_SIGNUP_DISABLED_CODE;
}

export type StaffRole = "SYSTEM_ADMIN" | "ADMIN" | "SECRETARY" | "TEACHER" | "FINANCE";
const ENABLED_ROLES = new Set<StaffRole>(["SYSTEM_ADMIN", "ADMIN", "TEACHER"]);

export type StaffAccessUser = {
  email: string;
  role: StaffRole;
  isEnabled: boolean;
};

export type StaffAccessDeniedReason = "UNKNOWN_EMAIL" | "DISABLED_USER" | "ROLE_NOT_ENABLED";

export type StaffAccessAllowed = { allowed: true };

export type StaffAccessDenied = {
  allowed: false;
  reason: StaffAccessDeniedReason;
  message: typeof STAFF_ACCESS_DENIED_MESSAGE;
};

export type StaffAccessResult = StaffAccessAllowed | StaffAccessDenied;

/** A staff member who passed the access check, as carried through a request. */
export type StaffIdentity = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isEnabled: boolean;
};

/**
 * Narrows a `User` row to the identity a request may act on, or `null` when the
 * row fails {@link evaluateStaffAccess}. Callers pass whatever their data source
 * returned; the shape below is the only part anything downstream may rely on.
 */
export function resolveStaffIdentity(
  user: (StaffAccessUser & { id: string; name: string }) | null,
): StaffIdentity | null {
  if (user === null || !evaluateStaffAccess(user).allowed) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEnabled: user.isEnabled,
  };
}

export function evaluateStaffAccess(user: StaffAccessUser | null): StaffAccessResult {
  if (user === null) {
    return denied("UNKNOWN_EMAIL");
  }

  if (!user.isEnabled) {
    return denied("DISABLED_USER");
  }

  if (!ENABLED_ROLES.has(user.role)) {
    return denied("ROLE_NOT_ENABLED");
  }

  return { allowed: true };
}

function denied(reason: StaffAccessDeniedReason): StaffAccessResult {
  return { allowed: false, reason, message: STAFF_ACCESS_DENIED_MESSAGE };
}
