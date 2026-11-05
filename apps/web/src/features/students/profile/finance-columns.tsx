import { BookOpen, DollarSign, GraduationCap, Handshake, Paperclip } from "lucide-react";
import type { ReactElement } from "react";
import { Badge, Button, type DataTableColumn } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { installmentVm, businessDate, originLabel } from "~/features/installments/view-model";
import {
  installmentColumnMode,
  type InstallmentSituation,
} from "~/features/installments/column-policy";

export type FinanceRow = FinanceInstallmentRow & { id: string };

export function financeColumns({
  onReceive,
  onViewProof,
  priorityId,
  onTreat,
  situations,
}: {
  onReceive: (row: FinanceInstallmentRow) => void;
  onViewProof: (row: FinanceInstallmentRow) => void;
  priorityId?: string | undefined;
  onTreat: (row: FinanceInstallmentRow) => void;
  situations: readonly InstallmentSituation[];
}): DataTableColumn<FinanceRow>[] {
  const mode = installmentColumnMode(situations);
  return [
    {
      id: "kind",
      header: "Tipo",
      width: "standard",
      cell: (row) => <ChargeKind row={row} />,
    },
    {
      id: "due",
      header: mode === "unpaid" && situations[0] === "OVERDUE" ? "Tempo em atraso" : "Vencimento",
      width: "medium",
      cell: (row) => (
        <DueDate row={row} overdue={mode === "unpaid" && situations[0] === "OVERDUE"} />
      ),
    },
    {
      id: "amount",
      header: "Valor nominal",
      width: "standard",
      numeric: true,
      cell: (row) => <InstallmentAmounts row={row} />,
    },
    ...(mode === "standard" || mode === "paid"
      ? [
          {
            id: "paid",
            header: "Valor pago",
            width: "standard" as const,
            numeric: true,
            cell: (row: FinanceRow) => money(row.paidAmountCents),
          },
        ]
      : []),
    ...(mode === "paid"
      ? [
          {
            id: "paidOn",
            header: "Data do pagamento",
            width: "medium" as const,
            cell: (row: FinanceRow) => formatDateOnlyBR(row.paidOn ?? undefined),
          },
          {
            id: "paymentMethods",
            header: "Forma de pagamento",
            width: "medium" as const,
            cell: (row: FinanceRow) => row.paymentMethodNames?.join(", ") || "—",
          },
        ]
      : []),
    ...(mode === "standard"
      ? [
          {
            id: "status",
            header: "Situação",
            width: "standard" as const,
            cell: (row: FinanceRow) => <InstallmentStatus row={row} />,
          },
        ]
      : []),
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "medium",
      cell: (row) => {
        if (row.status === "PAID") {
          return (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Ver comprovante de ${row.payer.name}, vencimento ${formatDateOnlyBR(row.dueDate)}`}
              onClick={() => onViewProof(row)}
            >
              <Paperclip aria-hidden="true" /> Ver comprovante
            </Button>
          );
        }
        if (row.collectibleBalanceCents <= 0) return null;
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant={row.installmentId === priorityId ? "primary" : "secondary"}
              onClick={() => onReceive(row)}
              aria-label={`Receber ${row.origin === "MATERIAL" ? "material" : `parcela ${row.sequenceNumber}`} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
            >
              <DollarSign aria-hidden="true" /> Receber
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onTreat(row)}
              aria-label={`Negociar ou suspender ${row.origin === "MATERIAL" ? "cobrança de material" : `parcela ${row.sequenceNumber}`}`}
            >
              <Handshake aria-hidden="true" /> Negociar
            </Button>
          </div>
        );
      },
    },
  ];
}

function ChargeKind({ row }: { row: FinanceInstallmentRow }): ReactElement {
  const Icon = row.origin === "MATERIAL" ? BookOpen : GraduationCap;
  return (
    <div className="grid gap-1">
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0 text-icon" aria-hidden="true" />
        {originLabel(row.origin)}
      </span>
      <span className="text-caption text-muted-foreground">{chargeKindDetail(row)}</span>
    </div>
  );
}

function chargeKindDetail(row: FinanceInstallmentRow): string {
  if (row.origin === "MATERIAL") return row.material?.name ?? "Material";
  return row.origin === "TUITION"
    ? `Parcela ${row.sequenceNumber} de ${row.scheduleTotal}`
    : "Cobrança única";
}

function DueDate({ row, overdue }: { row: FinanceInstallmentRow; overdue: boolean }): ReactElement {
  return overdue ? (
    <div className="grid gap-1">
      <span className="font-medium text-destructive">{row.overdueDays} dias em atraso</span>
      <span className="text-caption text-muted-foreground">
        Venceu em {formatDateOnlyBR(row.dueDate)}
      </span>
    </div>
  ) : (
    <span className="font-numeric whitespace-nowrap tabular-nums">
      {formatDateOnlyBR(row.dueDate)}
    </span>
  );
}

function InstallmentAmounts({ row }: { row: FinanceInstallmentRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span>{money(row.originalAmountCents)}</span>
      {row.collectibleBalanceCents > 0 && (
        <span className="text-caption text-muted-foreground">
          Saldo {money(row.collectibleBalanceCents)}
        </span>
      )}
    </div>
  );
}

function InstallmentStatus({ row }: { row: FinanceInstallmentRow }): ReactElement {
  const badge = installmentVm(row, businessDate(new Date())).badge;
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
