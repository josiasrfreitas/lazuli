import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AssessmentsPage } from "~/features/assessments/assessments-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Avaliações" };
export default async function AssessmentsRoute(): Promise<ReactElement> {
  await requireRole(["TEACHER", "ADMIN", "SYSTEM_ADMIN"]);
  return <AssessmentsPage />;
}
