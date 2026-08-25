import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth, getStaffIdentity } from "@lazuli/auth/server";

import { AppShell } from "~/components/app-shell/app-shell";

/**
 * The authenticated surface of the product. Every route inside this group is
 * checked on the server before it renders.
 *
 * The guard resolves the full staff identity, not just the session: a session
 * outlives being disabled or losing an enabled role, and such a person must
 * land on `/403` (where they can sign out) instead of rendering the app.
 * Sending them to `/login` would loop, because that page bounces anyone with a
 * session back here.
 *
 * There is no `middleware.ts` on purpose: the guard lives next to the routes it
 * guards, so adding a protected page is a matter of putting the file in this
 * folder rather than remembering to widen a matcher somewhere else.
 */
export default async function AppLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const requestHeaders = await headers();
  const identity = await getStaffIdentity({ headers: requestHeaders });

  if (identity === null) {
    const session = await auth.getSession({ headers: requestHeaders });
    redirect(session === null ? "/login" : "/403");
  }

  return <AppShell identity={identity}>{children}</AppShell>;
}
