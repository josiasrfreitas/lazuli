import { TeacherStudent } from "~/features/teacher-workspace/students";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherStudent id={id} />;
}
