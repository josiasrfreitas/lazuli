import type { ReactNode } from "react";
import { requireRole } from "~/lib/require-role";
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  await requireRole(["TEACHER"]);
  return children;
}
