import type { Metadata } from "next";
import { StageEditor } from "~/features/stage-catalog/detail";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Editor de estágio" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  const { id } = await params;
  return <StageEditor id={id} />;
}
