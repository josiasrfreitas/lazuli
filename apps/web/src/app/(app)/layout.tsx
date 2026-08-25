import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@lazuli/auth/server";

/**
 * The authenticated surface of the product. Every route inside this group is
 * checked on the server before it renders.
 *
 * There is no `middleware.ts` on purpose: the guard lives next to the routes it
 * guards, so adding a protected page is a matter of putting the file in this
 * folder rather than remembering to widen a matcher somewhere else.
 */
export default async function AppLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const session = await auth.getSession({ headers: await headers() });

  if (session === null) {
    redirect("/login");
  }

  return children;
}
