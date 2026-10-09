import type { Metadata } from "next";
import type { ReactElement } from "react";

import { InstallmentsPage } from "~/features/installments/installments-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Recebíveis" };

export default async function RecebiveisRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <InstallmentsPage />;
}
