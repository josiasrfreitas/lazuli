import type { Metadata } from "next";
import type { ReactElement } from "react";
import { FinanceAnalyticsPage } from "~/features/finance-analytics/finance-analytics-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Visão financeira" };
export default async function FinanceiroRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <FinanceAnalyticsPage />;
}
