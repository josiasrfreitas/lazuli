import { TeacherAttendancePage } from "~/features/student-attendance/teacher-page";

export const metadata = { title: "Chamada da aula" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherAttendancePage sessionId={id} />;
}
