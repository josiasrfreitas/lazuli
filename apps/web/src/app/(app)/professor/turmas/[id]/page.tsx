import type { JSX as ReactJSX } from "react";
import { TeacherClass } from "~/features/teacher-workspace/classes";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactJSX.Element> {
  const { id } = await params;
  return <TeacherClass id={id} />;
}
