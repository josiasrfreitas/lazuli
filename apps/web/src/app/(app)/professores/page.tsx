import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TeachersPage } from "~/features/teachers/teachers-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Professores" };

export default async function TeachersRoute(): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <TeachersPage />;
}
