import type { ReactElement } from "react";
import { OccurrenceDetail } from "~/features/pedagogical-follow-up/occurrence-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return <OccurrenceDetail id={id} />;
}
