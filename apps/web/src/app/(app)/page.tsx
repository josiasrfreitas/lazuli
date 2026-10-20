import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAgent } from "next/server";
import type { ReactNode } from "react";

import { getStaffIdentity } from "@lazuli/auth/server";
import { EmptyState } from "@lazuli/ui";

import { homeHrefFor } from "~/components/app-shell/nav-items";
import { experienceActivationHref } from "~/lib/staff-experience";

export const metadata: Metadata = { title: "Início" };

/**
 * There is no dashboard yet, so Início forwards to the role's first vertical.
 * A role with no open vertical gets a quiet placeholder instead of landing on
 * a screen whose procedures would deny it.
 */
export default async function HomePage(): Promise<ReactNode> {
  const requestHeaders = await headers();
  const identity = await getStaffIdentity({ headers: requestHeaders });

  if (identity === null) {
    // The (app) layout guard already redirects; this only satisfies the type.
    redirect("/login");
  }

  if (
    userAgent({ headers: requestHeaders }).device.type === "mobile" &&
    identity.roles?.includes("TEACHER") &&
    identity.role !== "TEACHER"
  ) {
    redirect(experienceActivationHref("TEACHER", "/professor"));
  }

  const home = homeHrefFor(identity.role);

  if (home !== null) {
    redirect(home);
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        description="A área do seu perfil entra numa próxima versão."
        title="Nada por aqui ainda"
      />
    </div>
  );
}
