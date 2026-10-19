import { requireRole } from "~/lib/require-role";
import { TeacherPlanningContext } from "~/features/stage-planning/teacher-context";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClassPage } from "~/features/classes/class-page";

export const metadata: Metadata = { title: "Detalhes da turma" };

export default async function TurmaRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  if (identity.role === "TEACHER") return <TeacherPlanningContext classId={id} />;
  return <ClassPage id={id} />;
}
