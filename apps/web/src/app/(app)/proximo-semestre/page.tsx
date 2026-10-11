import type { Metadata } from "next";
import { SemesterOrganizationPage } from "~/features/semester-organization/page";
export const metadata: Metadata = { title: "Próximo semestre" };
export default function Page() {
  return <SemesterOrganizationPage />;
}
