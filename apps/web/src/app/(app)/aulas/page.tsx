import type { Metadata } from "next";
import { ClassAgenda } from "~/features/class-records/agenda";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Agenda" };
export default async function Page() {
  const identity = await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  return <ClassAgenda teacherView={identity.role === "TEACHER"} />;
}
