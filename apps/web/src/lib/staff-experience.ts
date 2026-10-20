import { STAFF_ROLE_COOKIE, type StaffRole } from "@lazuli/auth/roles";

const ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const INTERNAL_ORIGIN = "https://lazuli.invalid";

export function experienceHome(role: StaffRole): string {
  return role === "TEACHER" ? "/professor" : "/alunos";
}

/** An automatic profile switch must return to a local page, never another site. */
export function experienceDestination(value: string | null | undefined, role: StaffRole): string {
  if (!value?.startsWith("/")) return experienceHome(role);
  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return experienceHome(role);
  }
  if (
    url.origin !== INTERNAL_ORIGIN ||
    url.pathname === "/perfil" ||
    url.pathname.startsWith("/api/")
  )
    return experienceHome(role);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function experienceActivationHref(role: StaffRole, destination: string): string {
  const params = new URLSearchParams({
    perfil: role,
    retorno: experienceDestination(destination, role),
  });
  return `/perfil?${params}`;
}

/** A full navigation discards cached data and the previous experience's shell. */
export function activateExperience(role: StaffRole, destination: string): void {
  document.cookie = `${STAFF_ROLE_COOKIE}=${role}; Path=/; Max-Age=${ROLE_COOKIE_MAX_AGE}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.location.replace(experienceDestination(destination, role));
}
