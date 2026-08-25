export const STAFF_ACCESS_DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

/**
 * Machine-readable code carried by every staff-access denial, whatever the
 * underlying reason, so redirect handlers and the login screen can tell
 * "access denied" apart from other failures without ever exposing which of
 * the three denial reasons applied.
 */
export const STAFF_ACCESS_DENIED_CODE = "STAFF_ACCESS_DENIED";

export type StaffRole = "ADMIN" | "SECRETARY" | "TEACHER" | "FINANCE";
const ENABLED_ROLES = new Set<StaffRole>(["ADMIN", "TEACHER"]);

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
  user: (StaffAccessUser & { id: string }) | null,
): StaffIdentity | null {
  if (user === null || !evaluateStaffAccess(user).allowed) {
    return null;
  }

  return { id: user.id, email: user.email, role: user.role, isEnabled: user.isEnabled };
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
