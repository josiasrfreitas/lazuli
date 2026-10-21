import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PlanningPage } from "~/features/stage-planning/planning-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Planejamento" };
export default async function PlanejamentoRoute(): Promise<ReactElement> {
  await requireRole(["SYSTEM_ADMIN", "ADMIN", "TEACHER"]);
  return <PlanningPage />;
}
