const UNAUTHORIZED_MESSAGE = "Acesso não autorizado. Fale com a secretaria.";

export type StaffRole = "ADMIN" | "SECRETARY" | "TEACHER" | "FINANCE";
const ENABLED_ROLES = new Set<StaffRole>(["ADMIN", "TEACHER"]);

export type StaffAccessUser = {
  email: string;
  role: StaffRole;
  isEnabled: boolean;
};

export type StaffAccessDeniedReason = "UNKNOWN_EMAIL" | "DISABLED_USER" | "ROLE_NOT_ENABLED";

export type StaffAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: StaffAccessDeniedReason;
      message: typeof UNAUTHORIZED_MESSAGE;
    };

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
  return { allowed: false, reason, message: UNAUTHORIZED_MESSAGE };
}
