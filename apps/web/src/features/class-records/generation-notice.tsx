"use client";
import { useEffect, type ReactElement } from "react";
import { CalendarClock, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";

type Row = RouterOutputs["sessionGeneration"]["status"][number];
type Props = { classId?: string; from?: string; to?: string };

export function useSessionGeneration(props: Props) {
  const utils = trpc.useUtils();
  const query = trpc.sessionGeneration.status.useQuery(props, {
    refetchInterval: (state) =>
      state.state.data?.some((row) => row.pending && !row.stale) ? 3_000 : false,
  });
  const completionKey = query.data
    ?.filter((row) => row.request?.status === "SUCCEEDED")
    .map((row) => row.request?.id)
    .join(",");
  useEffect(() => {
    if (completionKey) void utils.classRecords.list.invalidate();
  }, [completionKey, utils]);
  return query;
}

export function GenerationNotice(props: Props): ReactElement | null {
  const query = useSessionGeneration(props);
  return <GenerationState query={query} showReady={Boolean(props.classId)} />;
}

export function GenerationState({
  query,
  showReady,
}: {
  query: ReturnType<typeof useSessionGeneration>;
  showReady: boolean;
}): ReactElement | null {
  if (query.isError)
    return (
      <p className="text-caption text-muted-foreground">
        Não foi possível consultar a preparação das aulas.{" "}
        <Button variant="link" onClick={() => void query.refetch()}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </p>
    );
  const rows =
    query.data?.filter(
      (row) =>
        showReady || row.pending || row.request?.status === "FAILED" || row.sessionCount === 0,
    ) ?? [];
  if (rows.length === 0) return null;
  return (
    <div className="grid min-w-0 gap-2" aria-label="Preparação das aulas">
      {rows.map((row) => (
        <GenerationRow key={row.classId} row={row} />
      ))}
    </div>
  );
}

function GenerationRow({ row }: { row: Row }): ReactElement | null {
  const utils = trpc.useUtils();
  const generate = trpc.classes.generateSessions.useMutation({
    onSuccess: async () => {
      await utils.sessionGeneration.status.invalidate();
    },
  });
  const failed = row.request?.status === "FAILED";
  const ready = row.request?.status === "SUCCEEDED";
  if (!row.request && row.sessionCount > 0) return null;
  const title = ready
    ? row.sessionCount > 0
      ? `${row.sessionCount} encontros preparados`
      : "Nenhum dia letivo compatível"
    : row.stale
      ? "A preparação está demorando"
      : row.pending
        ? "Preparando as aulas"
        : failed
          ? "A preparação das aulas precisa ser retomada"
          : "Aulas ainda não preparadas";
  const description = ready
    ? row.sessionCount > 0
      ? "Os encontros estão disponíveis na agenda da turma."
      : "Confira os horários da turma, o período do semestre e os dias de fechamento."
    : row.stale
      ? "Você pode tentar novamente. Os encontros existentes serão preservados."
      : row.pending
        ? "Os horários da turma e os dias letivos estão sendo organizados. A agenda será atualizada automaticamente."
        : "A turma está salva. Tente preparar os encontros para disponibilizá-los na agenda.";
  const Icon = ready ? Check : row.pending && !row.stale ? LoaderCircle : CalendarClock;
  return (
    <section
      className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
      role="status"
    >
      <Icon
        aria-hidden
        className={
          row.pending && !row.stale
            ? "size-4 shrink-0 animate-spin text-interactive"
            : "size-4 shrink-0 text-muted-foreground"
        }
      />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">· {row.className}</span>
        </p>
        <p className="mt-1 text-caption text-muted-foreground">{description}</p>
        {row.request && (
          <p className="mt-1 text-micro text-muted-foreground">
            Solicitado em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(row.request.createdAt)}
            {row.request.requestedBy ? ` por ${row.request.requestedBy.name}` : ""}
          </p>
        )}
        {generate.error && (
          <p role="alert" className="mt-1 text-caption text-destructive">
            {generate.error.message}
          </p>
        )}
      </div>
      {row.canGenerate && (
        <Button
          variant="secondary"
          size="sm"
          disabled={generate.isPending}
          onClick={() => generate.mutate({ classId: row.classId })}
        >
          <RefreshCw />
          {generate.isPending
            ? "Solicitando…"
            : ready
              ? "Atualizar encontros"
              : failed || row.stale
                ? "Tentar novamente"
                : "Preparar aulas"}
        </Button>
      )}
    </section>
  );
}
