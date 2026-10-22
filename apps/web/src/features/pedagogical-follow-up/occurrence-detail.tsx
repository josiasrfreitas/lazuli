"use client";
import type { ReactElement } from "react";
import { trpc } from "~/lib/trpc";
import { LegacyFollowUpRedirect } from "./legacy-redirect";
export function OccurrenceDetail({ id }: { id: string }): ReactElement {
  const query = trpc.occurrences.byId.useQuery({ id }, { retry: false });
  return (
    <LegacyFollowUpRedirect
      studentId={query.data?.studentId}
      selection={{ kind: "occurrence", id }}
      pending={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    />
  );
}
