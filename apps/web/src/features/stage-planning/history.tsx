"use client";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { dateLabel, targetFor, PlanTable, PlanningState, type Planning } from "./shared";
type Revision = RouterOutputs["planning"]["history"]["items"][number];
export function PlanHistory({ data }: { data: Planning }): ReactElement {
  const query = trpc.planning.history.useInfiniteQuery(targetFor(data), {
    getNextPageParam: (last) => last.nextCursor,
  });
  return (
    <section className="grid gap-4" aria-label="Versões do planejamento">
      <p className="text-caption text-muted-foreground">
        Cada versão preserva o roteiro e o prazo combinados naquele momento.
      </p>
      <PlanningState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((revision) => (
          <RevisionCard key={revision.id} revision={revision} />
        ))}
      {query.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Carregando…" : "Ver versões anteriores"}
          </Button>
        </div>
      )}
    </section>
  );
}
function RevisionCard({ revision }: { revision: Revision }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { snapshot } = revision;
  const recordedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(revision.createdAt));
  return (
    <article className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold">
            {revision.version === 1 ? "Plano inicial" : `Versão ${revision.version}`}
          </h3>
          <p className="text-caption text-muted-foreground">
            {revision.recordedBy} · {recordedAt}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Recolher" : `Ler versão ${revision.version}`}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{revision.reason}</p>
      <p className="text-caption text-muted-foreground">
        {dateLabel(snapshot.plannedStartOn)} — {dateLabel(snapshot.plannedEndOn)} ·{" "}
        {snapshot.items.length}{" "}
        {snapshot.items.length === 1 ? "atividade prevista" : "atividades previstas"}
      </p>
      {expanded && (
        <div className="grid min-w-0 gap-4 border-t border-border pt-4">
          {snapshot.objective && (
            <p className="whitespace-pre-wrap text-sm">{snapshot.objective}</p>
          )}
          <PlanTable items={snapshot.items} />
        </div>
      )}
    </article>
  );
}
