import Link from "next/link";
import { Badge, type DataTableColumn } from "@lazuli/ui";
import {
  interestLabel,
  formatLabel,
  dateLabel,
  dateOnly,
  statusLabels,
  type CandidateRow,
} from "./labels";
const baseColumns: DataTableColumn<CandidateRow>[] = [
  {
    id: "name",
    header: "Lead",
    width: "wide",
    cell: (row) => (
      <div className="grid gap-0.5">
        <Link
          className="font-medium underline-offset-4 hover:underline"
          href={`/interessados/${row.id}`}
        >
          {row.fullName}
        </Link>
        <span className="text-caption text-muted-foreground">{row.phone || row.email}</span>
      </div>
    ),
  },
  {
    id: "interest",
    header: "Interesse",
    width: "wide",
    cell: (row) => (
      <div className="grid gap-0.5">
        <span>
          {row.scheduleType
            ? `${interestLabel(row.scheduleType)} · ${formatLabel(row.format)}`
            : "Interesse a definir"}
        </span>
        <span className="text-caption text-muted-foreground">
          {row.stage?.name ?? "Nivelamento pendente"}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Situação",
    width: "medium",
    cell: (row) => (
      <Badge variant={row.status === "ENROLLED" ? "success" : "neutral"}>
        {statusLabels[row.status]}
      </Badge>
    ),
  },
];

export function admissionColumns(today: string): DataTableColumn<CandidateRow>[] {
  return [
    baseColumns[0]!,
    {
      id: "next",
      header: "Próximo passo",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-0.5">
          <span>
            {row.nextAction ?? (row.status === "WAITING" ? "Definir próximo passo" : "—")}
          </span>
          {row.nextActionOn && (
            <span
              className={`text-caption ${dateOnly(row.nextActionOn) < today && row.status === "WAITING" ? "text-warning" : "text-muted-foreground"}`}
            >
              {dateOnly(row.nextActionOn) < today ? "Em atraso · " : ""}
              {dateLabel(row.nextActionOn)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "owner",
      header: "Responsável",
      width: "medium",
      cell: (row) => row.owner?.name ?? "Sem responsável",
    },
    baseColumns[1]!,
    baseColumns[2]!,
  ];
}
