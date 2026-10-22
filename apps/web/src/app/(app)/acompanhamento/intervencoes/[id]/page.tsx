import type { ReactElement } from "react";
import { InterventionDetail } from "~/features/pedagogical-follow-up/intervention-detail";
import { requireRole } from "~/lib/require-role";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  return <InterventionDetail id={id} />;
}
