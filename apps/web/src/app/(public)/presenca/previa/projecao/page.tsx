import type { JSX as ReactJSX } from "react";
import { AttendanceProjectionPreview } from "~/features/student-attendance/projection-preview";

export const metadata = { title: "Prévia · Projeção do QR" };

export default function Page(): ReactJSX.Element {
  return <AttendanceProjectionPreview />;
}
