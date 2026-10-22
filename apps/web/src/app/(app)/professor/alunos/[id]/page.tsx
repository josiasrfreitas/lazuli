import type { JSX as ReactJSX } from "react";
import { TeacherStudent } from "~/features/teacher-workspace/students";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactJSX.Element> {
  const { id } = await params;
  return <TeacherStudent id={id} />;
}
