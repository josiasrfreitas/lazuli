import type { ReactElement } from "react";
import { ArrowRight } from "lucide-react";

import type { RouterOutputs } from "@lazuli/api";
import { Badge, TableCell, TableRow } from "@lazuli/ui";

import { formatBRLFromCents } from "~/lib/format";

type ContractRow = RouterOutputs["finance"]["listContracts"]["rows"][number];

const MONTH_INDEX_OFFSET = 1;
const SHORT_YEAR_DIGITS = 2;
const MONTH_ABBREVIATIONS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function shortCivilDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day} ${MONTH_ABBREVIATIONS[Number(month) - MONTH_INDEX_OFFSET]} ${year?.slice(-SHORT_YEAR_DIGITS)}`;
}

function statusLabel(status: ContractRow["status"]): string {
  if (status === "INADIMPLENTE") return "Inadimplente";
  if (status === "EM_DIA") return "Em dia";
  return status === "QUITADO" ? "Quitado" : "Cancelado";
}

function statusVariant(status: ContractRow["status"]): "destructive" | "success" | "neutral" {
  if (status === "INADIMPLENTE") return "destructive";
  return status === "EM_DIA" ? "success" : "neutral";
}

export function ContractListRow({ row }: { row: ContractRow }): ReactElement {
  return (
    <TableRow>
      <TableCell className="font-medium">{row.student.fullName}</TableCell>
      <TableCell>
        <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
      </TableCell>
      <TableCell>
        {row.student.placements.length > 0
          ? row.student.placements.map((placement) => (
              <span key={`${placement.classCode}-${placement.stage}`} className="block">
                {placement.stage}
                <span className="block text-caption text-muted-foreground">
                  {placement.classCode} · {placement.modality}
                </span>
              </span>
            ))
          : "—"}
      </TableCell>
      <TableCell className="font-numeric tabular-nums">
        {formatBRLFromCents(row.monthlyAmountCents)}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <time dateTime={row.startsOn}>{shortCivilDate(row.startsOn)}</time>
          <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <time dateTime={row.endsOn}>{shortCivilDate(row.endsOn)}</time>
        </span>
      </TableCell>
      <TableCell>{row.payer.name}</TableCell>
    </TableRow>
  );
}
