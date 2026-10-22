import type { JSX as ReactJSX } from "react";
import { TeacherPendingPage } from "~/features/teacher-workspace/agenda";
export const metadata = { title: "Aulas por registrar" };
export default function Page(): ReactJSX.Element {
  return <TeacherPendingPage />;
}
