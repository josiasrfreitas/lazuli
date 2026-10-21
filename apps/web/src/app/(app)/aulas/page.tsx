import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ClassAgenda } from "~/features/class-records/agenda";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Aulas" };
export default async function AulasRoute(): Promise<ReactElement> {
  await requireRole(["SYSTEM_ADMIN", "ADMIN", "TEACHER"]);
  return <ClassAgenda />;
}
