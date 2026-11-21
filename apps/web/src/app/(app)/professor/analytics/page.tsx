import { TeacherAnalytics } from "~/features/teacher-workspace/analytics";
import type { ReactElement } from "react";

export const metadata = { title: "Analytics dos meus alunos" };
export default function Page(): ReactElement {
  return <TeacherAnalytics />;
}
