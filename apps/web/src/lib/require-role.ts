import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getStaffIdentity, type StaffIdentity, type StaffRole } from "@lazuli/auth/server";

/**
 * Guards a page that only some roles may open, for use inside the `(app)` route
 * group where a session is already guaranteed.
 *
 * A caller whose role is not listed lands on `/403` rather than `/login`: they
 * are signed in, so sending them back to the door would loop. Losing the session
 * between the group's layout and this call is treated the same way the layout
 * treats it — back to `/login`.
 */
export async function requireRole(allowed: readonly StaffRole[]): Promise<StaffIdentity> {
  const identity = await getStaffIdentity({ headers: await headers() });

  if (identity === null) {
    redirect("/login");
  }

  if (!allowed.includes(identity.role)) {
    redirect("/403");
  }

  return identity;
}
