import { OperationsPage } from "~/features/finance-analytics/operations-page";
import { requireRole } from "~/lib/require-role";
import type { ReactElement } from "react";

export default async function Page(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <OperationsPage area="pedagogico" />;
}
