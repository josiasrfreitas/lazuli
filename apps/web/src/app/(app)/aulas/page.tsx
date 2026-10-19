import type { Metadata } from "next";
import { ClassAgenda } from "~/features/class-records/agenda";
export const metadata: Metadata = { title: "Agenda" };
export default function Page() {
  return <ClassAgenda />;
}
