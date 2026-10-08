"use client";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { DataTable, type DataTableState } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { formatClassSchedule, formatFormat, formatScheduleType } from "./labels";
import type { ClassListParams as Params } from "./class-list-model";
type List = RouterOutputs["classes"]["list"];
type Row = List["rows"][number];
function tableState(
  data: List | undefined,
  flags: { error: boolean; filtered: boolean },
): DataTableState<Row> {
  if (flags.error) return { kind: "error" };
  if (!data) return { kind: "loading" };
  if (data.rows.length === 0) return { kind: flags.filtered ? "noResults" : "empty" };
  return { kind: "data", rows: data.rows };
}
function occupancy(row: Row): string {
  if (row.occupancy > row.capacity) return `${row.occupancy}/${row.capacity} · Acima da capacidade`;
  if (row.occupancy === row.capacity) return `${row.occupancy}/${row.capacity} · Cheia`;
  return `${row.occupancy}/${row.capacity}`;
}
function columns(
  params: Params,
): Array<{ id: string; header: string; width?: "wide" | "medium"; cell: (row: Row) => ReactNode }> {
  const back = new URLSearchParams({
    busca: params.busca,
    ...(params.tipo ? { tipo: params.tipo } : {}),
    ...(params.formato ? { formato: params.formato } : {}),
    ...(params.professor ? { professor: params.professor } : {}),
    ...(params.semestre ? { semestre: params.semestre } : {}),
    ...(params.estado ? { estado: params.estado } : {}),
    pagina: String(params.pagina),
  });
  return [
    {
      id: "code",
      header: "Turma",
      width: "wide" as const,
      cell: (row: Row) => (
        <Link
          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"
          href={`/turmas/${row.id}?voltar=${encodeURIComponent(`/turmas?${back}`)}`}
        >
          {row.internalCode}
        </Link>
      ),
    },
    { id: "type", header: "Organização", cell: (row: Row) => formatScheduleType(row.scheduleType) },
    { id: "format", header: "Formato", cell: (row: Row) => formatFormat(row.format) },
    {
      id: "teacher",
      header: "Professor",
      width: "medium" as const,
      cell: (row: Row) => row.teacher.name,
    },
    { id: "stage", header: "Etapa", cell: (row: Row) => row.sharedStage?.name ?? "Individual" },
    {
      id: "schedule",
      header: "Horários",
      width: "wide" as const,
      cell: (row: Row) => formatClassSchedule(row.scheduleSlots),
    },
    { id: "occupancy", header: "Ocupação", cell: occupancy },
  ];
}
export function ClassListTable({
  data,
  isError,
  refetch,
  params,
  setPage,
}: {
  data: List | undefined;
  isError: boolean;
  refetch: () => void;
  params: Params;
  setPage: (page: number) => void;
}): ReactElement {
  return (
    <DataTable
      label="Turmas"
      columns={columns(params)}
      state={tableState(data, {
        error: isError,
        filtered: Boolean(
          params.busca ||
          params.tipo ||
          params.formato ||
          params.professor ||
          params.semestre ||
          params.estado,
        ),
      })}
      onRetry={refetch}
      errorTitle="Não foi possível carregar as turmas"
      empty={{
        title: "Nenhuma turma cadastrada",
        description: "Crie a primeira turma para começar.",
      }}
      pagination={{
        page: params.pagina,
        pageSize: 20,
        pageCount: data?.pageCount ?? 1,
        totalItems: data?.total ?? 0,
        onPageChange: setPage,
        itemLabel: { singular: "turma", plural: "turmas" },
      }}
    />
  );
}
