import type { ReactElement } from "react";
import { OccurrenceDetail } from "~/features/pedagogical-follow-up/occurrence-detail";
import { requireRole } from "~/lib/require-role";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN", "TEACHER"]);
  const { id } = await params;
  return <OccurrenceDetail id={id} />;
}
