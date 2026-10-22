import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AdmissionsPage } from "~/features/admissions/admissions-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Leads" };
export default async function AdmissionsRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <AdmissionsPage />;
}
