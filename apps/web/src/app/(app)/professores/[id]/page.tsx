import { TeacherPage } from "~/features/teachers/teacher-page";
export default async function TeacherRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherPage id={id} />;
}
