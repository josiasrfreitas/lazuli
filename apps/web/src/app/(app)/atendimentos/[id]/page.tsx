import type { JSX as ReactJSX } from "react";
import type { Metadata } from "next";
import { AppointmentDetailPage } from "~/features/appointments/detail";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Atendimento pedagógico" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactJSX.Element> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  return <AppointmentDetailPage id={id} />;
}
