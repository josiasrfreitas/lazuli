import type { Metadata } from "next";
import { AppointmentDetailPage } from "~/features/appointments/detail";
export const metadata: Metadata = { title: "Atendimento pedagógico" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppointmentDetailPage id={id} />;
}
