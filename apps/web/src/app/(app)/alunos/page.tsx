import type { Metadata } from "next";
import type { ReactNode } from "react";

import { StudentsPage } from "~/features/students/students-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosRoute(): Promise<ReactNode> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <StudentsPage />;
}
