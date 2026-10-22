import type { JSX as ReactJSX } from "react";
import type { Metadata } from "next";
import { StagesPage } from "~/features/stage-catalog/stages-page";
import { requireRole } from "~/lib/require-role";

export const metadata: Metadata = { title: "Estágios" };
export default async function Page(): Promise<ReactJSX.Element> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  return <StagesPage />;
}
