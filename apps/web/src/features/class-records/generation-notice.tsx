"use client";
import { useEffect, type ReactElement } from "react";
import { CalendarClock, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";

const GENERATION_REFRESH_INTERVAL_MS = 3000;
const RETRY_LABEL = "Tentar novamente";

type Row = RouterOutputs["sessionGeneration"]["status"][number];
type Props = { classId?: string; from?: string; to?: string };
type GenerationCopy = { title: string; description: string; action: string };
type GenerationQuery = QueryResult<RouterOutputs["sessionGeneration"]["status"]>;

export function useSessionGeneration(props: Props): GenerationQuery {
  const utils = trpc.useUtils();
  const query = trpc.sessionGeneration.status.useQuery(props, {
    refetchInterval: (state) =>
      state.state.data?.some((row) => row.pending && !row.stale)
        ? GENERATION_REFRESH_INTERVAL_MS
        : false,
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
  if (!row.request && row.sessionCount > 0) return null;
  const copy = generationCopy(row);
  return (
    <section
      className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
      role="status"
    >
      <GenerationRowContent row={row} copy={copy} error={generate.error?.message ?? null} />
      {row.canGenerate && (
        <Button
          variant="secondary"
          size="sm"
          disabled={generate.isPending}
          onClick={() => generate.mutate({ classId: row.classId })}
        >
          <RefreshCw />
          {generate.isPending ? "Solicitando…" : copy.action}
        </Button>
      )}
    </section>
  );
}

export function generationCopy(row: Row): GenerationCopy {
  if (row.request?.status === "SUCCEEDED") return readyCopy(row.sessionCount);
  if (row.stale)
    return {
      title: "A preparação está demorando",
      description: "Você pode tentar novamente. Os encontros existentes serão preservados.",
      action: RETRY_LABEL,
    };
  if (row.pending) return pendingCopy(row.request?.status);
  return {
    title:
      row.request?.status === "FAILED"
        ? "A preparação das aulas precisa ser retomada"
        : "Aulas ainda não preparadas",
    description:
      "A turma está salva. Tente preparar os encontros para disponibilizá-los na agenda.",
    action: row.request?.status === "FAILED" ? RETRY_LABEL : "Preparar aulas",
  };
}

function readyCopy(sessionCount: number): GenerationCopy {
  return {
    title:
      sessionCount > 0 ? `${sessionCount} encontros preparados` : "Nenhum dia letivo compatível",
    description:
      sessionCount > 0
        ? "Os encontros estão disponíveis na agenda da turma."
        : "Confira os horários da turma, o período do semestre e os dias de fechamento.",
    action: "Atualizar encontros",
  };
}

function pendingCopy(status: NonNullable<Row["request"]>["status"] | undefined): GenerationCopy {
  return {
    title: "Preparando as aulas",
    description:
      "Os horários da turma e os dias letivos estão sendo organizados. A agenda será atualizada automaticamente.",
    action: status === "FAILED" ? RETRY_LABEL : "Preparar aulas",
  };
}

function GenerationRowContent({
  row,
  copy,
  error,
}: {
  row: Row;
  copy: GenerationCopy;
  error: string | null;
}): ReactElement {
  const spinning = row.pending && !row.stale;
  let Icon = CalendarClock;
  if (row.request?.status === "SUCCEEDED") Icon = Check;
  else if (spinning) Icon = LoaderCircle;
  return (
    <>
      <Icon
        aria-hidden
        className={
          spinning
            ? "size-4 shrink-0 animate-spin text-interactive"
            : "size-4 shrink-0 text-muted-foreground"
        }
      />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold">
          {copy.title} <span className="font-normal text-muted-foreground">· {row.className}</span>
        </p>
        <p className="mt-1 text-caption text-muted-foreground">{copy.description}</p>
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
        {error !== null && (
          <p role="alert" className="mt-1 text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
