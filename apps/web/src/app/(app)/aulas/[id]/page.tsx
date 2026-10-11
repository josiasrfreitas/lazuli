import type { Metadata } from "next";
import { ClassRecordPage } from "~/features/class-records/record-page";
export const metadata: Metadata = { title: "Registro da aula" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassRecordPage id={id} />;
}
