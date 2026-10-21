import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ClassRecordPage } from "~/features/class-records/record-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Registro da aula" };
export default async function AulaRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireRole(["SYSTEM_ADMIN", "ADMIN", "TEACHER"]);
  const { id } = await params;
  return <ClassRecordPage id={id} />;
}
