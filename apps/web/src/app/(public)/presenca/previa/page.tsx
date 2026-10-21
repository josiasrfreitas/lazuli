import type { JSX as ReactJSX } from "react";
import { StudentAttendancePreview } from "~/features/student-attendance/student-preview";

export const metadata = {
  title: "Prévia · Presença do aluno",
  robots: { index: false, follow: false },
};

export default function Page(): ReactJSX.Element {
  return <StudentAttendancePreview />;
}
