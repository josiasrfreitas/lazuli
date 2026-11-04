"use client";

import type { ReactElement } from "react";
import { Badge, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

const LEVELS = {
  HEALTHY: { label: "Vínculo saudável", variant: "success" },
  ATTENTION: { label: "Requer atenção", variant: "warning" },
  PRIORITY: { label: "Acompanhamento prioritário", variant: "destructive" },
  INSUFFICIENT_DATA: { label: "Sem dados suficientes", variant: "neutral" },
} as const;

/** Shares the profile's query and calculation without delaying the student listing. */
export function StudentScore({ studentId }: { studentId: string }): ReactElement {
  const query = trpc.students.health.useQuery({ id: studentId });
  if (query.isPending) return <InlineSkeleton className="h-4 w-8" aria-label="Carregando score" />;
  if (query.isError) return <span title="Score indisponível">—</span>;
  const level = LEVELS[query.data.level];
  return (
    <span title={`${level.label} · Saúde do vínculo`}>
      <Badge variant={level.variant}>
        <span
          aria-label={query.data.score === null ? level.label : `Score: ${query.data.score} de 100`}
        >
          {query.data.score ?? "—"}
        </span>
      </Badge>
    </span>
  );
}
