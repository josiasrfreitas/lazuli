import type { Metadata } from "next";
import { StagesPage } from "~/features/stage-catalog/stages-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Estágios" };
export default async function Page() {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <StagesPage />;
}
