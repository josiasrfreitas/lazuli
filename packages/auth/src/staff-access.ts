export const STAFF_ACCESS_DENIED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

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
