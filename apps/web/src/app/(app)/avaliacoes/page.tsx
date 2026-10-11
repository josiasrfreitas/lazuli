import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AssessmentsPage } from "~/features/assessments/assessments-page";
export const metadata: Metadata = { title: "Avaliações" };
export default function AssessmentsRoute(): ReactElement {
  return <AssessmentsPage />;
}
