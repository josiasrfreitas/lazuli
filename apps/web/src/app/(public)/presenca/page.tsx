import type { Metadata } from "next";
import type { ReactElement } from "react";
import { StudentAttendancePage } from "~/features/student-attendance/student-page";
export const metadata: Metadata = { title: "Presença", referrer: "no-referrer" };
export default function Page(): ReactElement {
  return <StudentAttendancePage />;
}
