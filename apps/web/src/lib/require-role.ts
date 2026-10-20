import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getStaffIdentity, type StaffIdentity, type StaffRole } from "@lazuli/auth/server";
import { experienceActivationHref, experienceHome } from "./staff-experience";

/**
 * Guards a page that only some roles may open, for use inside the `(app)` route
 * group where a session is already guaranteed.
 *
 * Shared pages keep the current experience. A page requiring another available
 * role activates it before mounting; a member without that role sees `/403`.
 */
export async function requireRole(allowed: readonly StaffRole[]): Promise<StaffIdentity> {
  const requestHeaders = await headers();
  const identity = await getStaffIdentity({ headers: requestHeaders });

  if (identity === null) {
    redirect("/login");
  }

  const roles = identity.roles ?? [identity.role];
  const role = allowed.includes(identity.role)
    ? identity.role
    : allowed.find((candidate) => roles.includes(candidate));
  if (!role) redirect("/403");

  if (role !== identity.role)
    redirect(
      experienceActivationHref(
        role,
        requestHeaders.get("x-lazuli-page-url") ?? experienceHome(role),
      ),
    );

  return identity;
}
