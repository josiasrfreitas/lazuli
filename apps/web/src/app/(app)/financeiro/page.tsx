import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { FinanceAnalyticsLoading } from "~/features/finance-analytics/finance-analytics-loading";
import { FinanceAnalyticsPage } from "~/features/finance-analytics/finance-analytics-page";
import { requireRole } from "~/lib/require-role";
import { createPageCaller } from "~/lib/page-caller";
import { toDateOnlySaoPaulo } from "~/lib/format";
export const metadata: Metadata = { title: "Visão financeira" };
export default async function FinanceiroRoute(): Promise<ReactElement> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return (
    <Suspense fallback={<FinanceAnalyticsLoading />}>
      <FinanceAnalyticsData email={identity.email} />
    </Suspense>
  );
}

async function FinanceAnalyticsData({ email }: { email: string }): Promise<ReactElement> {
  const year = Number(toDateOnlySaoPaulo(new Date()).split("-")[0]);
  const caller = await createPageCaller(email);
  const [initial, initialClosings] = await Promise.all([
    caller.finance.analytics({ year }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => {},
    ),
    caller.finance.contractClosings({ year }).then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => {},
    ),
  ]);
  return <FinanceAnalyticsPage initial={initial} initialClosings={initialClosings} />;
}
