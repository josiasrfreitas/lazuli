import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PlanningPage } from "~/features/stage-planning/planning-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Planejamento" };
export default async function Page(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  return <PlanningPage />;
}
