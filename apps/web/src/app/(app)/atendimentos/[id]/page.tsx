import type { Metadata } from "next";
import { AppointmentDetailPage } from "~/features/appointments/detail";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Atendimento pedagógico" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  return <AppointmentDetailPage id={id} />;
}
