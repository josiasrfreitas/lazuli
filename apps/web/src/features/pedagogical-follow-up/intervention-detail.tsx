"use client";
import type { ReactElement } from "react";
import { trpc } from "~/lib/trpc";
import { LegacyFollowUpRedirect } from "./legacy-redirect";
export function InterventionDetail({ id }: { id: string }): ReactElement {
  const query = trpc.interventions.byId.useQuery({ id }, { retry: false });
  return (
    <LegacyFollowUpRedirect
      studentId={query.data?.studentId}
      selection={{ kind: "intervention", id }}
      pending={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    />
  );
}
