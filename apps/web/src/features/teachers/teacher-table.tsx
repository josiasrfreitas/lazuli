"use client";
import type { ReactElement } from "react";
import { trpc } from "~/lib/trpc";

import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, DataTable, type DataTableColumn, type DataTableState } from "@lazuli/ui";
import { tablePaginationPropsFor, type UrlPagination } from "~/lib/pagination";
import { hoursLabel, metricNumber } from "./format";
import styles from "./teacher-table.module.css";
import { TeacherStatus } from "./teacher-status";

const SCORE_STALE_MS = 60_000;
const ISO_DATE_LENGTH = 10;
const MONTH_START = 5;
const MONTH_END = 7;
const YEAR_END = 4;

export function TeacherTable({
  data,
  isError,
  isFetching,
  filtered,
  pagination,
  href,
  onOpen,
  onRetry,
}: TeacherTableInput): ReactElement {
  const ids = data?.rows.map((row) => row.id) ?? [];
  const scores = trpc.teachers.listScores.useQuery(
    { ids },
    { enabled: ids.length > 0, staleTime: SCORE_STALE_MS },
  );
  return (
    <DataTable
      label="Docentes"
      loadingRows={pagination.pageSize}
      columns={teacherColumns({
        href,
        today: data?.today ?? "",
        score: (id) => scoreLabel(scores, id),
      })}
      state={teacherTableState({ data, isError, filtered })}
      onRowClick={(row) => onOpen(row.id)}
      onRetry={onRetry}
      updating={isFetching}
      errorTitle="Não foi possível carregar os docentes"
      empty={{
        title: "Nenhum docente cadastrado",
        description: "Em Colaboradores, marque “Atua como docente” no cadastro da pessoa.",
      }}
      pagination={{
        ...tablePaginationPropsFor(pagination, data),
        itemLabel: { singular: "docente", plural: "docentes" },
      }}
    />
  );
}

function scoreLabel(
  query: { isError: boolean; data: Record<string, number | null> | undefined },
  id: string,
): string {
  if (query.isError) return "Indisponível";
  if (!query.data) return "…";
  const value = query.data[id];
  return typeof value === "number" ? metricNumber(value) : "Sem dados";
}

type TeacherRow = RouterOutputs["teachers"]["list"]["rows"][number];
function teacherTableState({
  data,
  isError,
  filtered,
}: TeacherTableStateInput): DataTableState<TeacherRow> {
  if (isError) return { kind: "error" };
  if (!data) return { kind: "loading" };
  if (data.rows.length > 0) return { kind: "data", rows: data.rows };
  return { kind: filtered ? "noResults" : "empty" };
}
const appointmentHoursColumn: DataTableColumn<TeacherRow> = {
  id: "appointmentHours",
  header: <span className="whitespace-nowrap">Horas de atendimento</span>,
  width: "wide",
  cell: (row) => (
    <div
      className="grid gap-1"
      title="Horas realizadas com registro concluído / previstas no mês. 1 hora-aula = 60 minutos."
    >
      <span className="font-numeric tabular-nums">
        {hoursLabel(row.appointmentHours.completedMinutes)} /{" "}
        {hoursLabel(row.appointmentHours.plannedMinutes)} h
      </span>
    </div>
  ),
};

function teacherColumns({
  href,
  today,
  score,
}: TeacherColumnsInput): DataTableColumn<TeacherRow>[] {
  return [
    {
      id: "name",
      header: "Docente",
      width: "medium",
      cell: (row) => (
        <Link
          href={href(row.id)}
          title={row.name}
          className="block truncate font-medium underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "email",
      header: "E-mail",
      width: "wide",
      cell: (row) => (
        <span title={row.email} className="block truncate text-muted-foreground">
          {row.email}
        </span>
      ),
    },
    {
      id: "classes",
      header: "Turmas",
      width: "narrow",
      numeric: true,
      cell: (row) => (
        <span
          className="font-numeric tabular-nums"
          title="Turmas atuais sob responsabilidade do docente"
        >
          {row.classCount}
        </span>
      ),
    },
    {
      id: "score",
      header: "Score médio dos alunos",
      width: "standard",
      numeric: true,
      cell: (row) => score(row.id),
    },
    monthlyHoursColumn(today),
    appointmentHoursColumn,
    {
      id: "activity",
      header: "Atuação",
      width: "narrow",
      cell: (row) => <TeacherStatus departure={row.teacherProfile?.departureDate} today={today} />,
    },
    {
      id: "access",
      header: "Acesso ao sistema",
      width: "medium",
      cell: (row) => <TeacherAccess row={row} today={today} />,
    },
  ];
}
function TeacherAccess({ row, today }: TeacherAccessInput): ReactElement {
  const enabled =
    row.isEnabled &&
    (row.role === "ADMIN" ||
      row.role === "SYSTEM_ADMIN" ||
      !row.teacherProfile?.departureDate ||
      row.teacherProfile.departureDate.toISOString().slice(0, ISO_DATE_LENGTH) > today);
  return (
    <Badge variant={enabled ? "success" : "neutral"}>
      {enabled ? "Habilitado" : "Não habilitado"}
    </Badge>
  );
}

type TeacherTableInput = {
  data: RouterOutputs["teachers"]["list"] | undefined;
  isError: boolean;
  isFetching: boolean;
  filtered: boolean;
  pagination: UrlPagination;
  href: (id: string) => string;
  onOpen: (id: string) => void;
  onRetry: () => void;
};
type TeacherTableStateInput = {
  data: RouterOutputs["teachers"]["list"] | undefined;
  isError: boolean;
  filtered: boolean;
};
type TeacherColumnsInput = {
  score: (id: string) => string;
  href: (id: string) => string;
  today: string;
};
type TeacherAccessInput = { row: TeacherRow; today: string };

function monthlyHoursColumn(today: string): DataTableColumn<TeacherRow> {
  return {
    id: "monthlyHours",
    header: (
      <span className={styles.hoursHeader}>
        Horas · {today.slice(MONTH_START, MONTH_END)}/{today.slice(0, YEAR_END)}
      </span>
    ),
    width: "standard",
    cell: (row) => (
      <div
        className={styles.hours}
        title="Horas realizadas com registro concluído / previstas no mês. 1 hora-aula = 60 minutos."
      >
        <span className="font-numeric tabular-nums">
          {hoursLabel(row.monthlyHours.completedMinutes)} /{" "}
          {hoursLabel(row.monthlyHours.plannedMinutes)} h
        </span>
        <progress
          className={styles.progress}
          aria-label="Progresso das horas realizadas no mês"
          max={row.monthlyHours.plannedMinutes || 1}
          value={Math.min(row.monthlyHours.completedMinutes, row.monthlyHours.plannedMinutes)}
        />
      </div>
    ),
  };
}
