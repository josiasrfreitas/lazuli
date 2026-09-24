import type { ReactElement } from "react";

import { ContractsPage } from "~/features/contracts/contracts-page";
import { requireRole } from "~/lib/require-role";

export default async function ContratosRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <ContractsPage />;
}
