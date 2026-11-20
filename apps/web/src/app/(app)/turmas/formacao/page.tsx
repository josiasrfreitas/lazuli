import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ClassOrganizationPage } from "~/features/class-organization/page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Formação de turmas" };
export default async function Page(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <ClassOrganizationPage />;
}
