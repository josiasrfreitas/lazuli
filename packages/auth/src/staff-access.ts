const ISO_DATE_LENGTH = 10;

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
  deletedAt?: Date | null;
  teacherProfile?: { departureDate: Date | null; deletedAt?: Date | null } | null;
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
  roles?: StaffRole[];
  isEnabled: boolean;
};

/**
 * Narrows a `User` row to the identity a request may act on, or `null` when the
 * row fails {@link evaluateStaffAccess}. Callers pass whatever their data source
 * returned; the shape below is the only part anything downstream may rely on.
 */
export function resolveStaffIdentity(
  user: (StaffAccessUser & { id: string; name: string }) | null,
  now = new Date(),
  requestedRole?: string | null,
): StaffIdentity | null {
  if (user === null || !evaluateStaffAccess(user, now).allowed) {
    return null;
  }

  const roles = availableStaffRoles(user, now);
  const role = roles.find((candidate) => candidate === requestedRole) ?? roles[0]!;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    roles,
    isEnabled: user.isEnabled,
  };
}

export function evaluateStaffAccess(
  user: StaffAccessUser | null,
  now = new Date(),
): StaffAccessResult {
  if (user === null) {
    return denied("UNKNOWN_EMAIL");
  }

  if (!user.isEnabled || user.deletedAt) {
    return denied("DISABLED_USER");
  }

  const roles = availableStaffRoles(user, now);
  if (user.role === "TEACHER" && roles.length === 0) return denied("DISABLED_USER");
  if (!roles.some((role) => ENABLED_ROLES.has(role))) {
    return denied("ROLE_NOT_ENABLED");
  }

  return { allowed: true };
}

export const STAFF_ROLE_COOKIE = "lazuli.staff-role";

/** The administrative role and teaching profile coexist on the same staff identity. */
export function availableStaffRoles(user: StaffAccessUser, now = new Date()): StaffRole[] {
  const roles: StaffRole[] = user.role === "TEACHER" ? [] : [user.role];
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const departed = user.teacherProfile?.departureDate
    ? user.teacherProfile.departureDate.toISOString().slice(0, ISO_DATE_LENGTH) <= today
    : false;
  if (
    (user.role === "TEACHER" || user.teacherProfile) &&
    !departed &&
    !user.teacherProfile?.deletedAt
  )
    roles.push("TEACHER");
  return roles.filter((role) => ENABLED_ROLES.has(role));
}

export function staffRoleFromHeaders(headers?: Headers): string | undefined {
  return headers
    ?.get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${STAFF_ROLE_COOKIE}=`))
    ?.slice(STAFF_ROLE_COOKIE.length + 1);
}

function denied(reason: StaffAccessDeniedReason): StaffAccessResult {
  return { allowed: false, reason, message: STAFF_ACCESS_DENIED_MESSAGE };
}
