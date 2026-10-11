import type { Metadata } from "next";
import { AppointmentsAgenda } from "~/features/appointments/agenda";
export const metadata: Metadata = { title: "Atendimentos" };
export default function Page() {
  return <AppointmentsAgenda />;
}
