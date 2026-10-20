import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ContractClosingsPage } from "~/features/finance-analytics/contract-closings-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Visão financeira" };
export default async function FinanceiroRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <ContractClosingsPage />;
}
