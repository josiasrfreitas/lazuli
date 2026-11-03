"use client";
import Link from "next/link";

import { useEffect, useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import {
  Alert,
  Badge,
  Button,
  DataTable,
  InlineSkeleton,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import { trpc, type QueryResult } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";

type Generation = RouterOutputs["classes"]["generation"];
type Session = RouterOutputs["classes"]["sessions"]["rows"][number];
const PAGE_SIZE = 25;
const DATE_ONLY_LENGTH = 10;
const POLL_INTERVAL_MS = 2000;
const TIME_START = 11;
const TIME_END = 16;
const columns: DataTableColumn<Session>[] = [
  {
    id: "date",
    header: "Data",
    cell: (row) => (
      <Link className="text-interactive hover:underline" href={`/aulas/${row.id}`}>
        {formatDateOnlyBR(row.date.toISOString().slice(0, DATE_ONLY_LENGTH))}
      </Link>
    ),
  },
  {
    id: "time",
    header: "Horário",
    cell: (row) =>
      `${row.startTime.toISOString().slice(TIME_START, TIME_END)}–${row.endTime.toISOString().slice(TIME_START, TIME_END)}`,
  },
  {
    id: "status",
    header: "Situação",
    cell: (row) => (
      <Badge variant={row.status === "CANCELLED" ? "neutral" : "info"}>
        {row.status === "CANCELLED" ? "Cancelada" : "Programada"}
      </Badge>
    ),
  },
];

export function ClassSessions({ classId }: { classId: string }): ReactElement {
  const [page, setPage] = useState(1);
  const query = trpc.classes.sessions.useQuery({ id: classId, page, pageSize: PAGE_SIZE });
  const data = query.data;
  return (
    <div className="grid min-w-0 gap-4">
      <DataTable
        label="Aulas da turma"
        columns={columns}
        state={sessionState(query)}
        onRetry={() => void query.refetch()}
        errorTitle="Não foi possível consultar as aulas"
        empty={{
          title: "Nenhuma aula preparada",
          description: "Confira o horário e o calendário da turma e prepare os encontros acima.",
        }}
        pagination={
          data
            ? {
                page: data.page,
                pageSize: PAGE_SIZE,
                pageCount: data.pageCount,
                totalItems: data.total,
                onPageChange: setPage,
                itemLabel: { singular: "aula", plural: "aulas" },
              }
            : { page, pageSize: PAGE_SIZE, loading: true, onPageChange: setPage }
        }
      />
    </div>
  );
}

function sessionState(query: {
  data: { rows: Session[] } | undefined;
  isError: boolean;
}): DataTableState<Session> {
  if (query.isError) return { kind: "error" };
  if (!query.data) return { kind: "loading" };
  return query.data.rows.length > 0 ? { kind: "data", rows: query.data.rows } : { kind: "empty" };
}

export function GenerationNotice({ classId }: { classId: string }): ReactElement {
  const { query, generate } = useSessionGeneration(classId);
  if (query.isPending)
    return <InlineSkeleton className="h-16 w-full" aria-label="Consultando preparação das aulas" />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        Não foi possível consultar a preparação.{" "}
        <Button variant="link" size="inline" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    );
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="grid min-w-0 flex-1 gap-1" aria-live="polite">
        <p className="text-control font-semibold">Calendário da turma</p>
        <p className="text-caption text-muted-foreground">{generationMessage(query.data)}</p>
        {generate.isError && (
          <p role="alert" className="text-caption text-destructive">
            Não foi possível solicitar a preparação. Tente novamente.
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={generate.isPending || !query.data.canGenerate}
        onClick={() => generate.mutate({ classId })}
      >
        {generate.isPending ? "Aguarde…" : generationAction(query.data)}
      </Button>
    </div>
  );
}

function generationMessage(data: Generation): string {
  if (data.stale)
    return "A preparação está demorando mais que o esperado. Você pode tentar novamente com segurança.";
  if (data.pending)
    return "Preparando as aulas. Você pode sair desta página e consultar o resultado depois.";
  if (data.request?.status === "FAILED")
    return "A turma está salva, mas as aulas não puderam ser preparadas. Tente novamente.";
  if (data.sessionCount > 0)
    return `${data.sessionCount} aulas no calendário. Repreparar preserva os encontros e os registros existentes.`;
  if (data.request?.status === "SUCCEEDED")
    return "Nenhum encontro neste horário e período. Confira a recorrência e os dias sem aula.";
  return "As aulas ainda não foram preparadas. O horário, o período e os dias sem aula definem as datas.";
}

function generationAction(data: Generation): string {
  if (data.pending && !data.stale) return "Preparando aulas…";
  if (data.stale || data.request?.status === "FAILED") return "Tentar novamente";
  return data.sessionCount > 0 ? "Atualizar aulas" : "Preparar aulas";
}

function useSessionGeneration(classId: string): {
  query: QueryResult<Generation>;
  generate: ReturnType<typeof trpc.classes.generateSessions.useMutation>;
} {
  const utils = trpc.useUtils();
  const query = trpc.classes.generation.useQuery(
    { id: classId },
    {
      refetchInterval: (current) => (current.state.data?.pending ? POLL_INTERVAL_MS : false),
    },
  );
  const generate = trpc.classes.generateSessions.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.generation.invalidate({ id: classId }),
        utils.classes.sessions.invalidate({ id: classId }),
      ]);
    },
  });
  const completedRequestId =
    query.data?.request?.status === "SUCCEEDED" ? query.data.request.id : null;
  useEffect(() => {
    if (completedRequestId) void utils.classes.sessions.invalidate({ id: classId });
  }, [classId, completedRequestId, utils]);
  return { query, generate };
}
