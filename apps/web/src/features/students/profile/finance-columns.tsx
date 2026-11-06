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

type FinanceColumnOptions = {
  onReceive: (row: FinanceInstallmentRow) => void;
  onViewProof: (row: FinanceInstallmentRow) => void;
  priorityId?: string | undefined;
  onTreat: (row: FinanceInstallmentRow) => void;
  situations: readonly InstallmentSituation[];
};

export function financeColumns(options: FinanceColumnOptions): DataTableColumn<FinanceRow>[] {
  const mode = installmentColumnMode(options.situations);
  const overdue = mode === "unpaid" && options.situations[0] === "OVERDUE";
  return [
    {
      id: "kind",
      header: "Tipo",
      width: "standard",
      cell: (row) => <ChargeKind row={row} />,
    },
    {
      id: "due",
      header: overdue ? "Tempo em atraso" : "Vencimento",
      width: "medium",
      cell: (row) => <DueDate row={row} overdue={overdue} />,
    },
    {
      id: "amount",
      header: "Valor nominal",
      width: "standard",
      numeric: true,
      cell: (row) => <InstallmentAmounts row={row} />,
    },
    ...conditionalFinanceColumns(mode),
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "wide",
      cell: (row) => <FinanceAction row={row} options={options} />,
    },
  ];
}

function conditionalFinanceColumns(
  mode: ReturnType<typeof installmentColumnMode>,
): DataTableColumn<FinanceRow>[] {
  const columns: DataTableColumn<FinanceRow>[] = [];
  if (mode === "standard" || mode === "paid")
    columns.push({
      id: "paid",
      header: "Valor pago",
      width: "standard",
      numeric: true,
      cell: (row) => money(row.paidAmountCents),
    });
  if (mode === "paid")
    columns.push(
      {
        id: "paidOn",
        header: "Data do pagamento",
        width: "medium",
        cell: (row) => formatDateOnlyBR(row.paidOn ?? undefined),
      },
      {
        id: "paymentMethods",
        header: "Forma de pagamento",
        width: "medium",
        cell: (row) => row.paymentMethodNames?.join(", ") || "—",
      },
    );
  if (mode === "standard")
    columns.push({
      id: "status",
      header: "Situação",
      width: "standard",
      cell: (row) => <InstallmentStatus row={row} />,
    });
  return columns;
}

function FinanceAction({
  row,
  options,
}: {
  row: FinanceInstallmentRow;
  options: FinanceColumnOptions;
}): ReactElement | null {
  if (row.status === "PAID")
    return (
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Ver comprovante de ${row.payer.name}, vencimento ${formatDateOnlyBR(row.dueDate)}`}
        onClick={() => options.onViewProof(row)}
      >
        <Paperclip aria-hidden="true" /> Ver comprovante
      </Button>
    );
  if (row.collectibleBalanceCents <= 0) return null;
  return (
    <div className="flex flex-nowrap items-center justify-end gap-2">
      <Button
        size="sm"
        variant={row.installmentId === options.priorityId ? "primary" : "secondary"}
        onClick={() => options.onReceive(row)}
        aria-label={`Receber ${row.origin === "MATERIAL" ? "material" : `parcela ${row.sequenceNumber}`} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
      >
        <DollarSign aria-hidden="true" /> Receber
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => options.onTreat(row)}
        aria-label={`Negociar ou suspender ${row.origin === "MATERIAL" ? "cobrança de material" : `parcela ${row.sequenceNumber}`}`}
      >
        <Handshake aria-hidden="true" /> Negociar
      </Button>
    </div>
  );
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
