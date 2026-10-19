import { TeacherClass } from "~/features/teacher-workspace/classes";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherClass id={id} />;
}
