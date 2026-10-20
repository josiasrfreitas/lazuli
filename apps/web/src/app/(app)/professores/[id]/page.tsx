import type { Metadata } from "next";
import type { ReactElement } from "react";
import { TeacherPage } from "~/features/teachers/teacher-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Detalhes do professor" };

export default async function TeacherRoute({ params }: TeacherRouteInput): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  const { id } = await params;
  return <TeacherPage id={id} />;
}

type TeacherRouteInput = { params: Promise<{ id: string }> };
