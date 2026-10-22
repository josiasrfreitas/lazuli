import Link from "next/link";
import { Badge, type DataTableColumn } from "@lazuli/ui";
import {
  dateLabel,
  formatLabel,
  leadInterestLabels,
  statusLabels,
  type CandidateRow,
} from "./labels";

export const admissionColumns: DataTableColumn<CandidateRow>[] = [
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
    width: "medium",
    cell: (row) => leadInterestLabels[row.interest],
  },
  {
    id: "stage",
    header: "Estágio",
    width: "wide",
    cell: (row) => (
      <div className="grid gap-0.5">
        <span>
          {row.stage?.name ??
            (row.englishExperience === "SOME" ? "Nivelamento pendente" : "A definir")}
        </span>
        {row.format && (
          <span className="text-caption text-muted-foreground">
            Prefere {formatLabel(row.format).toLowerCase()}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "medium",
    cell: (row) => (
      <Badge variant={row.status === "ENROLLED" ? "success" : "neutral"}>
        {statusLabels[row.status]}
      </Badge>
    ),
  },
  { id: "created", header: "Cadastro", width: "medium", cell: (row) => dateLabel(row.createdAt) },
];
