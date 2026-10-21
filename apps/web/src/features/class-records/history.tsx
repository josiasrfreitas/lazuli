"use client";
import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { QueryLoading } from "~/components/query-loading";
import { trpc } from "~/lib/trpc";
import { RecordState, SnapshotView } from "./shared";
const MISSING_AUTHOR = "autoria não registrada";
const historyTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
export function ClassRecordHistory({ sessionId }: { sessionId: string }): ReactElement {
  const query = trpc.classRecords.history.useInfiniteQuery(
    { sessionId },
    { getNextPageParam: (last) => last.nextCursor },
  );
  return (
    <section className="grid gap-4" aria-label="Histórico da baixa">
      {query.isPending ? (
        <div className="flex items-center gap-3 py-4 text-caption text-muted-foreground">
          <QueryLoading label="Carregando histórico" />
        </div>
      ) : (
        <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages
        .flatMap((page) => page.items)
        .map((row) => (
          <Revision key={row.id} row={row} />
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

function Revision({
  row,
}: {
  row: RouterOutputs["classRecords"]["history"]["items"][number];
}): ReactElement {
  return (
    <article className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold">
          {row.version === 1 ? "Registro inicial" : `Correção · versão ${row.version}`}
        </h3>
        <p className="mt-1 text-caption text-muted-foreground">
          {row.author} · {historyTime.format(new Date(row.recordedAt))}
        </p>
      </div>
      <p className="whitespace-pre-wrap text-sm">{row.reason}</p>
      <details>
        <summary className="cursor-pointer text-caption font-medium text-interactive">
          Ler registro desta versão
        </summary>
        <div className="pt-4">
          <SnapshotView snapshot={row.snapshot} />
          {row.snapshot.attendanceOrigin && (
            <p className="mt-3 text-caption text-muted-foreground">
              Chamada confirmada por{" "}
              {row.snapshot.attendanceOrigin.confirmedBy?.name ?? MISSING_AUTHOR} ·{" "}
              {row.snapshot.attendanceOrigin.confirmedAt
                ? historyTime.format(new Date(row.snapshot.attendanceOrigin.confirmedAt))
                : "horário não registrado"}
              . Frequência anterior à baixa:
            </p>
          )}
          {row.snapshot.attendanceOrigin?.entries.map((entry) => (
            <p key={entry.enrollmentId} className="mt-2 text-caption text-muted-foreground">
              {
                row.snapshot.entries.find((student) => student.enrollmentId === entry.enrollmentId)
                  ?.name
              }
              : chamada por {entry.recordedBy?.name ?? MISSING_AUTHOR} em{" "}
              {historyTime.format(new Date(entry.recordedAt))}.
              {entry.modifiedAt &&
                ` Alterada por ${entry.modifiedBy?.name ?? MISSING_AUTHOR} em ${historyTime.format(new Date(entry.modifiedAt))}.`}
            </p>
          ))}
        </div>
      </details>
    </article>
  );
}
