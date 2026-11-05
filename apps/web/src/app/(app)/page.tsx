import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAgent } from "next/server";
import type { ReactNode } from "react";

import { getStaffIdentity } from "@lazuli/auth/server";
import { createServiceLogger, requestIdFromHeaders, withCheckpoint } from "@lazuli/logging";
import { EmptyState } from "@lazuli/ui";

import { AdminHome, type InitialDashboardData } from "~/features/admin-home/home";

import { homeHrefFor } from "~/components/app-shell/nav-items";
import { experienceActivationHref } from "~/lib/staff-experience";
import { createPageCaller } from "~/lib/page-caller";

const logger = createServiceLogger("web");
const INITIAL_DASHBOARD_REQUESTS = 3;

export const metadata: Metadata = { title: "Início" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ entrada?: string }>;
}): Promise<ReactNode> {
  const requestHeaders = await headers();
  const requestLogger = logger.child({
    request_id: requestIdFromHeaders(requestHeaders),
    route: "/",
  });
  const identity = await withCheckpoint(requestLogger, {
    checkpoint: "staff_identity",
    action: () => getStaffIdentity({ headers: requestHeaders }),
  });

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
    const initial = await loadDashboardInitialData(identity.email, requestLogger);
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

async function loadDashboardInitialData(
  email: string,
  requestLogger: ReturnType<typeof createServiceLogger>,
): Promise<InitialDashboardData> {
  const caller = await createPageCaller(email);
  const started = performance.now();
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
  const loadedCount =
    Number(Boolean(home)) + Number(Boolean(business)) + Number(Boolean(pendingLessons));
  requestLogger[loadedCount === INITIAL_DASHBOARD_REQUESTS ? "info" : "warn"](
    {
      checkpoint: "initial_data",
      duration_ms: Math.round(performance.now() - started),
      loaded_count: loadedCount,
      expected_count: INITIAL_DASHBOARD_REQUESTS,
      status: loadedCount === INITIAL_DASHBOARD_REQUESTS ? "ok" : "partial",
    },
    "Dashboard initial data settled",
  );
  return {
    ...(home ? { home } : {}),
    ...(business ? { business } : {}),
    ...(pendingLessons ? { pendingLessons } : {}),
  };
}
