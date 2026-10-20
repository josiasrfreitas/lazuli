import type { Metadata } from "next";
import type { ReactElement } from "react";
import { requireRole } from "~/lib/require-role";
import { StudentPage } from "~/features/students/profile/student-page";

export const metadata: Metadata = { title: "Perfil do aluno" };

export default async function StudentRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  const { id } = await params;
  return <StudentPage id={id} />;
}
