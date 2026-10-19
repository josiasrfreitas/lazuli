import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassOrganizationPage, OrganizationLoading } from "~/features/class-organization/page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Organização de turmas" };
export default async function Page() {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return (
    <Suspense fallback={<OrganizationLoading />}>
      <ClassOrganizationPage />
    </Suspense>
  );
}
