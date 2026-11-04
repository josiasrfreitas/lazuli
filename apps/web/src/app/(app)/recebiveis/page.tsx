import type { Metadata } from "next";
import type { ReactElement } from "react";
import { createCaller, createTRPCContext } from "@lazuli/api";
import { financeInstallmentsPaginationPolicy } from "@lazuli/validators";

import { normalizeFilters, queryInput } from "~/features/installments/filters";
import { InstallmentsPage } from "~/features/installments/installments-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Recebíveis" };

export default async function RecebiveisRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  if (Object.keys(await searchParams).length > 0) return <InstallmentsPage />;

  const caller = createCaller(
    await createTRPCContext({ session: { user: { email: identity.email } } }),
  );
  const initial = await caller.finance
    .installments(
      queryInput(
        normalizeFilters(
          {
            status: null,
            search: null,
            situations: null,
            origins: null,
            dueFrom: null,
            dueTo: null,
            amountFrom: null,
            amountTo: null,
          },
          { page: 1, pageSize: financeInstallmentsPaginationPolicy.defaultPageSize },
        ),
      ),
    )
    .then(
      (data) => ({ data, updatedAt: Date.now() }),
      (): undefined => undefined,
    );
  return <InstallmentsPage initial={initial} />;
}
