import type { RouterOutputs } from "@lazuli/api";
import { Avatar, Badge, type DataTableColumn } from "@lazuli/ui";

import { paymentPlanLabel } from "./contract-payment-summary";
import { ContractPaymentProgress } from "./contract-payment-progress";

export type ContractRow = RouterOutputs["finance"]["listContracts"]["rows"][number];

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

export const contractColumns: readonly DataTableColumn<ContractRow>[] = [
  {
    id: "student",
    header: "Aluno",
    width: "wide",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <Avatar colorKey={row.student.id} name={row.student.fullName} size="sm" />
        <span className="font-medium">{row.student.fullName}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Situação",
    width: "standard",
    cell: (row) => <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>,
  },
  {
    id: "placement",
    header: "Estágio / turma",
    width: "standard",
    cell: (row) =>
      row.student.placements.length > 0
        ? row.student.placements.map((placement) => (
            <span key={`${placement.classCode}-${placement.stage}`} className="block">
              {placement.stage}
              <span className="block text-micro text-muted-foreground">
                {placement.classCode} · {placement.modality}
              </span>
            </span>
          ))
        : "—",
  },
  {
    id: "amount",
    header: "Plano",
    width: "standard",
    numeric: true,
    cell: (row) => (
      <span className="block font-numeric whitespace-normal">
        {paymentPlanLabel(row.installmentCount, row.uniformInstallmentAmountCents)}
      </span>
    ),
  },
  {
    id: "paymentProgress",
    header: "Pagamento",
    width: "standard",
    cell: (row) => <ContractPaymentProgress progress={row.paymentProgress} />,
  },
  {
    id: "term",
    header: "Vigência",
    width: "standard",
    cell: (row) => (
      <span className="flex flex-col font-numeric">
        <time dateTime={row.startsOn}>{shortCivilDate(row.startsOn)}</time>
        <span className="text-micro text-muted-foreground">
          até <time dateTime={row.endsOn}>{shortCivilDate(row.endsOn)}</time>
        </span>
      </span>
    ),
  },
  { id: "payer", header: "Pagador", width: "standard", cell: (row) => row.payer.name },
];
