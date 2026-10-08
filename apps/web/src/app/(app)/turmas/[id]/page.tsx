import type { ReactNode } from "react";

import { ClassPage } from "~/features/classes/class-page";

export default async function TurmaRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  return <ClassPage id={id} />;
}
