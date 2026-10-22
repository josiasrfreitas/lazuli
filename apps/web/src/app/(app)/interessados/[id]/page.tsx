import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CandidatePage } from "~/features/admissions/candidate-page";
import { requireRole } from "~/lib/require-role";
export const metadata: Metadata = { title: "Lead" };
export default async function CandidateRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  await requireRole(["ADMIN", "SYSTEM_ADMIN"]);
  const { id } = await params;
  return <CandidatePage id={id} />;
}
