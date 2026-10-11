import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PlanningPage } from "~/features/stage-planning/planning-page";
export const metadata: Metadata = { title: "Planejamento" };
export default function Page(): ReactElement {
  return <PlanningPage />;
}
