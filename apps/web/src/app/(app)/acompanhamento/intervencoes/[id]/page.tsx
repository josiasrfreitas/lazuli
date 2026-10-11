import type { ReactElement } from "react";
import { InterventionDetail } from "~/features/pedagogical-follow-up/intervention-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return <InterventionDetail id={id} />;
}
