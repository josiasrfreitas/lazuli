import type { JSX as ReactJSX } from "react";
import { TeacherAttendancePreview } from "~/features/student-attendance/teacher-preview";

export const metadata = { title: "Prévia · Chamada do professor" };

export default function Page(): ReactJSX.Element {
  return <TeacherAttendancePreview />;
}
