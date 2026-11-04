import type { Metadata } from "next";
import { createCaller, createTRPCContext } from "@lazuli/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAgent } from "next/server";
import type { ReactNode } from "react";

import { getStaffIdentity } from "@lazuli/auth/server";
import { EmptyState } from "@lazuli/ui";

import { AdminHome, type InitialDashboardData } from "~/features/admin-home/home";

import { homeHrefFor } from "~/components/app-shell/nav-items";
import { experienceActivationHref } from "~/lib/staff-experience";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ entrada?: string }>;
}): Promise<ReactNode> {
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

  if (identity.role === "ADMIN" || identity.role === "SYSTEM_ADMIN") {
    const params = await searchParams;
    const caller = createCaller(
      await createTRPCContext({ session: { user: { email: identity.email } } }),
    );
    const [home, business, pendingLessons] = await Promise.all([
      caller.dashboard.home().then(
        (data) => ({ data, updatedAt: Date.now() }),
        (): undefined => undefined,
      ),
      caller.dashboard.business().then(
        (data) => ({ data, updatedAt: Date.now() }),
        (): undefined => undefined,
      ),
      caller.dashboard.pendingLessonSummaries().then(
        (data) => ({ data, updatedAt: Date.now() }),
        (): undefined => undefined,
      ),
    ]);
    const initial: InitialDashboardData = {
      ...(home ? { home } : {}),
      ...(business ? { business } : {}),
      ...(pendingLessons ? { pendingLessons } : {}),
    };
    return (
      <AdminHome
        name={identity.name}
        canViewFinance
        arriving={params.entrada === "1"}
        initial={initial}
      />
    );
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
