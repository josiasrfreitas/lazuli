import type { Metadata } from "next";
import { SemesterOrganizationPage } from "~/features/semester-organization/page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Próximo semestre" };
export default async function Page() {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <SemesterOrganizationPage />;
}
