"use client";
import { useState, useEffect, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { saoPauloDateOnly, weekDates } from "@lazuli/domain";
import {
  Badge,
  Button,
  DataTable,
  Input,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";

type Lesson = RouterOutputs["classRecords"]["list"][number];
const LAST_WEEKDAY = 6;
const WEEK_LENGTH = 7;
const DATE_LENGTH = 10;
const LABELS = {
  CANCELLED: "Cancelada",
  RECORDED: "Registrada",
  UPCOMING: "Prevista",
  PENDING: "Pendente de registro",
} as const;
const columns: DataTableColumn<Lesson>[] = [
  {
    id: "date",
    header: "Aula",
    width: "medium",
    cell: (row) => (
      <div className="grid gap-1">
        <span>{formatDateOnlyBR(row.date)}</span>
        <span className="font-numeric text-caption">
          {row.startTime}–{row.endTime}
        </span>
      </div>
    ),
  },
  {
    id: "class",
    header: "Turma",
    width: "wide",
    cell: (row) => (
      <Link className="text-interactive hover:underline" href={`/aulas/${row.id}`}>
        {row.className}
        {row.stageName ? ` · ${row.stageName}` : ""}
      </Link>
    ),
  },
  { id: "teacher", header: "Professor", cell: (row) => row.teacher ?? "Sem professor" },
  {
    id: "state",
    header: "Situação",
    cell: (row) => (
      <div className="grid justify-items-start gap-1">
        <Badge variant={row.state === "PENDING" ? "warning" : "neutral"}>{LABELS[row.state]}</Badge>
        {row.attendanceOnly && (
          <span className="text-caption">Frequência confirmada · falta o relato</span>
        )}
      </div>
    ),
  },
];
export function ClassAgenda(): ReactElement {
  const [date, setDate] = useState(() => saoPauloDateOnly(new Date()));
  const [pendingMode, setPendingMode] = useState(false);
  const [page, setPage] = useState(1);
  const [monday, sunday] = weekBounds(date);
  const query = trpc.classRecords.list.useQuery({ from: monday, to: sunday });
  const pending = trpc.classRecords.pending.useQuery({ page });
  const rows = pendingMode ? pending.data?.rows : query.data;
  const failed = pendingMode ? pending.isError : query.isError;
  return (
    <div className="grid min-w-0 content-start gap-5 p-4 sm:p-6">
      <AgendaHeader date={date} onChange={setDate} />
      <AgendaMode
        pendingMode={pendingMode}
        total={pending.data?.total}
        from={monday}
        to={sunday}
        toggle={() => {
          setPendingMode(!pendingMode);
          setPage(1);
        }}
      />
      <DataTable
        label={pendingMode ? "Aulas pendentes de registro" : "Aulas da semana"}
        columns={columns}
        state={tableState(failed, rows)}
        empty={{
          title: "Nenhuma aula nesta seleção",
          description: "Consulte outra semana ou as turmas atribuídas.",
        }}
        errorTitle="Não foi possível consultar as aulas"
        onRetry={() => void Promise.all([query.refetch(), pending.refetch()])}
        {...(pendingMode && pending.data
          ? {
              pagination: {
                page: pending.data.page,
                pageSize: PAGE_SIZE,
                pageCount: pending.data.pageCount,
                totalItems: pending.data.total,
                onPageChange: setPage,
                itemLabel: { singular: "aula", plural: "aulas" },
              },
            }
          : {})}
      />
    </div>
  );
}
const PAGE_SIZE = 25;
function tableState(failed: boolean, rows: Lesson[] | undefined): DataTableState<Lesson> {
  if (failed) return { kind: "error" };
  if (!rows) return { kind: "loading" };
  return rows.length > 0 ? { kind: "data", rows } : { kind: "empty" };
}
function WeekControls({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(() => formatDateOnlyBR(date));
  useEffect(() => setDraft(formatDateOnlyBR(date)), [date]);
  const select = (value: string): void => {
    setDraft(maskDateBR(value));
    const parsed = parseDateBR(value);
    if (parsed) onChange(parsed);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Semana anterior"
        onClick={() => onChange(shift(weekStart(date), -WEEK_LENGTH))}
      >
        <ArrowLeft aria-hidden />
      </Button>
      <Input
        aria-label="Data da semana"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        size="sm"
        className="w-40"
        value={draft}
        onChange={(event) => select(event.target.value)}
      />
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Próxima semana"
        onClick={() => onChange(shift(weekStart(date), WEEK_LENGTH))}
      >
        <ArrowRight aria-hidden />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onChange(saoPauloDateOnly(new Date()))}>
        Hoje
      </Button>
    </div>
  );
}
function weekStart(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  const offset = (date.getUTCDay() + LAST_WEEKDAY) % WEEK_LENGTH;
  return shift(value, -offset);
}
function shift(value: string, offset: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, DATE_LENGTH);
}

function AgendaHeader({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}): ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-h1 text-heading">Aulas</h1>
        <p className="text-caption text-muted-foreground">Agenda semanal · horários de São Paulo</p>
      </div>
      <WeekControls date={date} onChange={onChange} />
    </header>
  );
}

function AgendaMode({
  pendingMode,
  total,
  from,
  to,
  toggle,
}: {
  pendingMode: boolean;
  total: number | undefined;
  from: string;
  to: string;
  toggle: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption">
        {pendingMode
          ? "Pendências de todas as semanas"
          : `${formatDateOnlyBR(from)} a ${formatDateOnlyBR(to)}`}
      </p>
      <Button variant="secondary" size="sm" onClick={toggle}>
        {pendingMode ? "Ver semana" : `Ver pendências${total === undefined ? "" : ` (${total})`}`}
      </Button>
    </div>
  );
}

function weekBounds(date: string): [string, string] {
  const monday = weekStart(date);
  return [monday, weekDates(monday)[LAST_WEEKDAY]!];
}
