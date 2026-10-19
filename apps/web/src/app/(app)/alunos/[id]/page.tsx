import { requireRole } from "~/lib/require-role";
import { TeacherPlanningContext } from "~/features/stage-planning/teacher-context";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { StudentPage } from "~/features/students/profile/student-page";

export const metadata: Metadata = { title: "Perfil do aluno" };
export default async function StudentRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  if (identity.role === "TEACHER") return <TeacherPlanningContext studentId={id} />;
  return <StudentPage id={id} />;
}
