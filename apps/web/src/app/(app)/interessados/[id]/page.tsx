import type { Metadata } from "next";
import type { ReactElement } from "react";
import { CandidatePage } from "~/features/admissions/candidate-page";
export const metadata: Metadata = { title: "Entrada e alocação" };
export default async function CandidateRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await params;
  return <CandidatePage id={id} />;
}
