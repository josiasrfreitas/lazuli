import type { Metadata } from "next";
import { StudentAttendancePage } from "~/features/student-attendance/student-page";
export const metadata: Metadata = { title: "Presença na aula", referrer: "no-referrer" };
export default function Page() {
  return <StudentAttendancePage />;
}
