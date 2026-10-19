import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
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
    header: "Data",
    width: "standard",
    cell: (row) => (
      <ClassRecordTrigger
        sessionId={row.sessionId}
        label={`Ver aula de ${formatDateOnlyBR(row.date)}, ${row.className}`}
      >
        {formatDateOnlyBR(row.date)}
      </ClassRecordTrigger>
    ),
  },
  {
    id: "weekday",
    header: "Dia",
    width: "narrow",
    cell: (row) => (
      <span className="text-caption text-muted-foreground">
        {WEEKDAY.format(new Date(row.date))}
      </span>
    ),
  },
  {
    id: "time",
    header: "Horário",
    width: "standard",
    cell: (row) => (
      <span className="whitespace-nowrap font-numeric text-caption tabular-nums">
        {row.startTime}–{row.endTime}
      </span>
    ),
  },
  {
    id: "class",
    header: "Turma",
    width: "standard",
    cell: (row) => <span className="font-medium">{row.className}</span>,
  },
  {
    id: "semester",
    header: "Semestre",
    width: "narrow",
    cell: (row) => <span className="text-caption text-muted-foreground">{row.semester}</span>,
  },
  {
    id: "status",
    header: "Presença",
    width: "medium",
    cell: (row) => (
      <Badge variant={STATUS[row.status].variant}>
        {row.status === "PENDING" && row.confirmed ? "Sem registro" : STATUS[row.status].label}
      </Badge>
    ),
  },
  {
    id: "compensation",
    header: "Reposição",
    width: "standard",
    cell: (row) =>
      row.compensatedMinutes > 0 ? (
        <span className="text-caption font-medium text-success">
          {row.compensatedMinutes === row.minutes
            ? `Reposta · ${row.compensatedMinutes} min`
            : `${row.compensatedMinutes}/${row.minutes} min`}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "notes",
    header: "Observações",
    width: "wide",
    cell: (row) =>
      row.notes ? (
        <p
          className="line-clamp-2 whitespace-pre-line break-words text-caption text-muted-foreground"
          title={row.notes}
        >
          {row.notes}
        </p>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];
