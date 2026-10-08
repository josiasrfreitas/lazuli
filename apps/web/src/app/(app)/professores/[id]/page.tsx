import type { ReactElement } from "react";
import { TeacherPage } from "~/features/teachers/teacher-page";

export default async function TeacherRoute({ params }: TeacherRouteInput): Promise<ReactElement> {
  const { id } = await params;
  return <TeacherPage id={id} />;
}

type TeacherRouteInput = { params: Promise<{ id: string }> };
