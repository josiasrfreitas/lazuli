import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AttendanceProjectionPage } from "~/features/student-attendance/projection-page";
export const metadata: Metadata = { title: "Projeção de presença", referrer: "no-referrer" };
export default function Page(): ReactElement {
  return <AttendanceProjectionPage />;
}
