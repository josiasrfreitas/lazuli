"use client";

import { createContext, useContext, type ReactElement, type ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

const LEVELS = {
  HEALTHY: { label: "Vínculo saudável", variant: "success" },
  ATTENTION: { label: "Requer atenção", variant: "warning" },
  PRIORITY: { label: "Acompanhamento prioritário", variant: "destructive" },
  INSUFFICIENT_DATA: { label: "Sem dados suficientes", variant: "neutral" },
} as const;

type Score = RouterOutputs["students"]["healthBatch"][number];
type ScoresState = { rows: Score[]; pending: boolean };
const ScoresContext = createContext<ScoresState>({ rows: [], pending: false });

export function StudentScores({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}): ReactElement {
  const query = trpc.students.healthBatch.useQuery(
    { ids: [...new Set(ids)].toSorted() },
    { enabled: ids.length > 0 },
  );
  return (
    <ScoresContext value={{ rows: query.data ?? [], pending: ids.length > 0 && query.isPending }}>
      {children}
    </ScoresContext>
  );
}

export function StudentScore({ studentId }: { studentId: string }): ReactElement {
  const { rows, pending } = useContext(ScoresContext);
  if (pending) return <InlineSkeleton className="h-4 w-8" aria-label="Carregando score" />;
  const score = rows.find((row) => row.studentId === studentId);
  if (!score) return <span title="Score indisponível">—</span>;
  const level = LEVELS[score.level];
  return (
    <span title={`${level.label} · Saúde do vínculo`}>
      <Badge variant={level.variant}>
        <span aria-label={score.score === null ? level.label : `Score: ${score.score} de 100`}>
          {score.score ?? "—"}
        </span>
      </Badge>
    </span>
  );
}
