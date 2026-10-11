import Link from "next/link";
import { Badge, type DataTableColumn } from "@lazuli/ui";
import { dateLabel, dateOnly, statusLabels, type CandidateRow } from "./labels";
const baseColumns: DataTableColumn<CandidateRow>[] = [
  {
    id: "name",
    header: "Interessado",
    width: "wide",
    cell: (row) => (
      <div className="grid gap-1">
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
    width: "standard",
    cell: (row) => (
      <div className="grid gap-1">
        <span>{row.scheduleType === "REGULAR" ? "Regular" : "Personalizado"}</span>
        <span className="text-caption text-muted-foreground">
          {row.format === "IN_PERSON" ? "Presencial" : "Online"}
        </span>
      </div>
    ),
  },
  {
    id: "stage",
    header: "Estágio indicado",
    width: "wide",
    cell: (row) => (
      <span className={row.stage ? "" : "text-muted-foreground"}>
        {row.stage?.name ?? "Aguardando nivelamento"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Situação",
    width: "wide",
    cell: (row) => (
      <Badge variant={row.status === "ENROLLED" ? "success" : "neutral"}>
        {statusLabels[row.status]}
      </Badge>
    ),
  },
];

export function admissionColumns(today: string): DataTableColumn<CandidateRow>[] {
  const availability: DataTableColumn<CandidateRow> = {
    id: "availability",
    header: "Disponibilidade",
    width: "standard",
    cell: (row) =>
      dateOnly(row.availableUntil) < today && row.status === "WAITING" ? (
        <Badge variant="warning">Confirmar horários</Badge>
      ) : (
        <span className="text-caption text-muted-foreground">
          Até {dateLabel(row.availableUntil)}
        </span>
      ),
  };
  return [
    ...baseColumns.slice(0, AVAILABILITY_COLUMN),
    availability,
    baseColumns[AVAILABILITY_COLUMN]!,
  ];
}

const AVAILABILITY_COLUMN = 3;
