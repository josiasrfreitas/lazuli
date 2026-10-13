import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, type DataTableColumn } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";

export type AttendanceHistory = RouterOutputs["students"]["attendanceHistory"];
type AttendanceRow = AttendanceHistory["rows"][number];
const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const STATUS = {
  PRESENT: { label: "Presença", variant: "success" },
  ABSENT: { label: "Falta", variant: "warning" },
  PENDING: { label: "Chamada pendente", variant: "neutral" },
  CANCELLED: { label: "Aula cancelada", variant: "neutral" },
} as const;

export const attendanceHistoryColumns: DataTableColumn<AttendanceRow>[] = [
  {
    id: "date",
    header: "Data / horário",
    width: "medium",
    cell: (row) => (
      <div className="grid gap-1">
        <Link
          href={`/aulas/${row.sessionId}`}
          aria-label={`Ver aula de ${formatDateOnlyBR(row.date)}, ${row.className}`}
          className="inline-flex w-fit items-center gap-1.5 font-numeric font-semibold tabular-nums text-interactive hover:underline"
        >
          {formatDateOnlyBR(row.date)}
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
        <span className="font-numeric text-caption tabular-nums text-muted-foreground">
          {WEEKDAY.format(new Date(row.date))} · {row.startTime}–{row.endTime}
        </span>
      </div>
    ),
  },
  {
    id: "class",
    header: "Turma / semestre",
    width: "medium",
    cell: (row) => (
      <div className="grid gap-1">
        <span className="font-medium">{row.className}</span>
        <span className="text-caption text-muted-foreground">{row.semester}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Presença",
    width: "standard",
    cell: (row) => (
      <Badge variant={STATUS[row.status].variant}>
        {row.status === "PENDING" && row.confirmed ? "Sem registro" : STATUS[row.status].label}
      </Badge>
    ),
  },
  {
    id: "notes",
    header: "Observações / reposição",
    width: "wide",
    cell: (row) => <AttendanceNotes row={row} />,
  },
];

function AttendanceNotes({ row }: { row: AttendanceRow }): ReactElement {
  const hasCompensation = row.compensatedMinutes > 0;
  return (
    <div className="grid gap-1 text-caption">
      {hasCompensation && (
        <span className="font-medium text-success">
          {row.compensatedMinutes === row.minutes
            ? `Falta reposta · ${row.compensatedMinutes} min`
            : `${row.compensatedMinutes} de ${row.minutes} min repostos`}
        </span>
      )}
      {row.notes ? (
        <p className="whitespace-pre-line break-words text-muted-foreground">{row.notes}</p>
      ) : !hasCompensation ? (
        <span className="text-muted-foreground">—</span>
      ) : null}
    </div>
  );
}
