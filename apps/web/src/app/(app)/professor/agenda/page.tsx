import { TeacherAgenda } from "~/features/teacher-workspace/agenda";
import type { ReactElement } from "react";

export const metadata = { title: "Minha agenda" };

export default function Page(): ReactElement {
  return <TeacherAgenda />;
}
