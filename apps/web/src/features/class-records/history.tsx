"use client";
import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";
import { Button, PencilLoader } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RecordState, SnapshotView } from "./shared";
export function ClassRecordHistory({ sessionId }: { sessionId: string }): ReactElement {
  const query = trpc.classRecords.history.useInfiniteQuery(
    { sessionId },
    { getNextPageParam: (last) => last.nextCursor },
  );
  return (
    <section className="grid gap-4" aria-label="Histórico da baixa">
      {query.isPending ? (
        <div className="flex items-center gap-3 py-4 text-caption text-muted-foreground">
          <PencilLoader size="sm" label="Carregando histórico" />
          <span aria-hidden="true">Carregando histórico…</span>
        </div>
      ) : (
        <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((row) => (
          <article
            key={row.id}
            className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
          >
            <div>
              <h3 className="text-sm font-semibold">
                {row.version === 1 ? "Registro inicial" : `Correção · versão ${row.version}`}
              </h3>
              <p className="mt-1 text-caption text-muted-foreground">
                {row.author} ·{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Sao_Paulo",
                }).format(new Date(row.recordedAt))}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm">{row.reason}</p>
            <details>
              <summary className="cursor-pointer text-caption font-medium text-interactive">
                Ler registro desta versão
              </summary>
              <div className="pt-4">
                <SnapshotView snapshot={row.snapshot} />
              </div>
            </details>
          </article>
        ))}
      {query.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            <ChevronDown aria-hidden="true" />
            Ver versões anteriores
          </Button>
        </div>
      )}
    </section>
  );
}
