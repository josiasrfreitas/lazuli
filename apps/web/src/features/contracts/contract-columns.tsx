import type { CSSProperties, ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Avatar, Badge, type BadgeVariant, type DataTableColumn } from "@lazuli/ui";

import { abbreviatedPersonName } from "~/lib/format";
import { paymentPlanLabel } from "./contract-payment-summary";

export type ContractRow = RouterOutputs["finance"]["listContracts"]["rows"][number];

const STATUS_LABELS: Record<ContractRow["status"], string> = {
  INADIMPLENTE: "Inadimplente",
  EM_DIA: "Em dia",
  QUITADO: "Quitado",
  SEM_SALDO: "Sem saldo a cobrar",
  CANCELADO: "Cancelada",
};
const STATUS_VARIANTS: Record<ContractRow["status"], BadgeVariant> = {
  INADIMPLENTE: "destructive",
  EM_DIA: "success",
  QUITADO: "neutral",
  SEM_SALDO: "neutral",
  CANCELADO: "neutral",
};

function ContractFinancialStatus({ row }: { row: ContractRow }): ReactElement {
  return <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>;
}

const PERCENT = 100;

function ContractPaymentProgress({
  progress,
}: {
  progress: ContractRow["paymentProgress"];
}): ReactElement {
  const { paid, total, waived, cancelled } = progress;
  const label = `${paid} de ${total} pagas`;
  const exceptions = [
    waived > 0 ? `${waived} ${waived === 1 ? "dispensada" : "dispensadas"}` : null,
    cancelled > 0 ? `${cancelled} ${cancelled === 1 ? "cancelada" : "canceladas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="font-numeric whitespace-nowrap">
        {label}
      </span>
      <div
        role="progressbar"
        aria-label="Parcelas pagas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-valuetext={exceptions ? `${label}; ${exceptions}` : label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full w-(--payment-progress) rounded-full bg-interactive"
          style={{ "--payment-progress": `${(paid / total) * PERCENT}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

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

const COLUMN_WIDTHS = {
  student: "medium",
  status: "narrow",
  term: "medium",
  placement: "standard",
  amount: "standard",
  paymentProgress: "standard",
  payer: "narrow",
} as const satisfies Record<string, NonNullable<DataTableColumn<ContractRow>["width"]>>;

export const contractColumns: readonly DataTableColumn<ContractRow>[] = [
  {
    id: "student",
    header: "Aluno",
    width: COLUMN_WIDTHS.student,
    cell: (row) => (
      <div className="flex items-center gap-3">
        <Avatar colorKey={row.student.id} name={row.student.fullName} size="sm" />
        <span className="min-w-0 font-medium break-words whitespace-normal">
          {row.student.fullName}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: COLUMN_WIDTHS.status,
    cell: (row) => <ContractFinancialStatus row={row} />,
  },
  {
    id: "term",
    header: "Vigência",
    width: COLUMN_WIDTHS.term,
    cell: (row) => (
      <span className="font-numeric whitespace-nowrap text-muted-foreground">
        <time dateTime={row.startsOn}>{shortCivilDate(row.startsOn)}</time>
        {" → "}
        <time dateTime={row.endsOn}>{shortCivilDate(row.endsOn)}</time>
      </span>
    ),
  },
  {
    id: "placement",
    header: "Estágio / turma",
    width: COLUMN_WIDTHS.placement,
    cell: (row) =>
      row.student.placements.length > 0
        ? row.student.placements.map((placement) => (
            <span
              key={`${placement.classCode}-${placement.stageCode}`}
              className="block break-words"
            >
              {placement.stageCode} · {placement.classCode}
            </span>
          ))
        : "—",
  },
  {
    id: "amount",
    header: "Plano",
    width: COLUMN_WIDTHS.amount,
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
    width: COLUMN_WIDTHS.paymentProgress,
    cell: (row) => <ContractPaymentProgress progress={row.paymentProgress} />,
  },
  {
    id: "payer",
    header: "Pagador",
    width: COLUMN_WIDTHS.payer,
    cell: (row) => <span title={row.payer.name}>{abbreviatedPersonName(row.payer.name)}</span>,
  },
];
