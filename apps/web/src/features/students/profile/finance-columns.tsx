import { BookOpen, DollarSign, GraduationCap, Handshake } from "lucide-react";
import type { ReactElement } from "react";
import { Badge, Button, type DataTableColumn } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { installmentVm, businessDate, originLabel } from "~/features/installments/view-model";
export type FinanceRow = FinanceInstallmentRow & { id: string };
const COLUMNS: DataTableColumn<FinanceRow>[] = [
  {
    id: "kind",
    header: "Tipo",
    width: "standard",
    cell: (row) => <ChargeKind row={row} />,
  },
  {
    id: "origin",
    header: "Cobrança / pagador",
    width: "medium",
    cell: (row) => <InstallmentIdentity row={row} />,
  },
  {
    id: "due",
    header: "Vencimento",
    width: "narrow",
    cell: (row) => formatDateOnlyBR(row.dueDate),
  },
  {
    id: "amount",
    header: "Valor / saldo",
    width: "narrow",
    numeric: true,
    cell: (row) => <InstallmentAmounts row={row} />,
  },
  {
    id: "status",
    header: "Situação",
    width: "standard",
    cell: (row) => <InstallmentStatus row={row} />,
  },
];
export function financeColumns({
  onReceive,
  priorityId,
  onTreat,
}: {
  onReceive: (row: FinanceRow) => void;
  priorityId?: string | undefined;
  onTreat?: (row: FinanceRow) => void;
}): DataTableColumn<FinanceRow>[] {
  return [
    ...(priorityId ? queueColumns() : COLUMNS),
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "medium",
      cell: (row) =>
        row.collectibleBalanceCents > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant={row.installmentId === priorityId ? "primary" : "secondary"}
              onClick={() => onReceive(row)}
              aria-label={`Receber ${row.origin === "MATERIAL" ? "material" : `parcela ${row.sequenceNumber}`} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
            >
              <DollarSign aria-hidden="true" /> Receber
            </Button>
            {onTreat && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onTreat(row)}
                aria-label={`Negociar ou suspender ${row.origin === "MATERIAL" ? "cobrança de material" : `parcela ${row.sequenceNumber}`}`}
              >
                <Handshake aria-hidden="true" /> Negociar
              </Button>
            )}
          </div>
        ) : null,
    },
  ];
}
function queueColumns(): DataTableColumn<FinanceRow>[] {
  return [
    {
      id: "due",
      header: "Tempo em atraso",
      width: "medium",
      cell: (row) => (
        <div className="grid gap-1">
          <span className="whitespace-nowrap font-medium text-destructive">
            {row.overdueDays} dias em atraso
          </span>
          <span className="whitespace-nowrap text-caption text-muted-foreground">
            Venceu em {formatDateOnlyBR(row.dueDate)}
          </span>
        </div>
      ),
    },
    COLUMNS[0]!,
    COLUMNS[1]!,
    {
      id: "balance",
      header: "Saldo a receber",
      width: "standard",
      numeric: true,
      cell: (row) => (
        <div className="grid gap-1">
          <span className="font-numeric text-lg font-semibold">
            {money(row.collectibleBalanceCents)}
          </span>
          <span className="text-caption text-muted-foreground">
            {row.paidAmountCents > 0
              ? `${money(row.paidAmountCents)} já pagos`
              : "Nenhum pagamento"}
          </span>
        </div>
      ),
    },
  ];
}
function InstallmentIdentity({ row }: { row: FinanceRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span className="font-medium">{row.material?.name ?? row.payer.name}</span>
      {row.material && <span className="text-caption text-muted-foreground">{row.payer.name}</span>}
      {row.beneficiaries.length > 1 && (
        <span className="text-caption text-muted-foreground">
          Compartilhada entre {row.beneficiaries.length} alunos · valor integral
        </span>
      )}
    </div>
  );
}
function ChargeKind({ row }: { row: FinanceRow }): ReactElement {
  const material = row.origin === "MATERIAL";
  const Icon = material ? BookOpen : GraduationCap;
  return (
    <div className="grid gap-1">
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0 text-icon" aria-hidden="true" />
        {originLabel(row.origin)}
      </span>
      <span className="text-caption text-muted-foreground">
        {material
          ? "Cobrança única · repasse"
          : row.origin === "TUITION"
            ? `Parcela ${row.sequenceNumber} de ${row.scheduleTotal}`
            : "Cobrança única"}
      </span>
    </div>
  );
}
function InstallmentAmounts({ row }: { row: FinanceRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span>{money(row.originalAmountCents)}</span>
      {row.paidAmountCents > 0 && (
        <span className="text-caption text-muted-foreground">
          Pago {money(row.paidAmountCents)}
        </span>
      )}
      {row.collectibleBalanceCents > 0 && (
        <span className="text-caption text-muted-foreground">
          Saldo {money(row.collectibleBalanceCents)}
        </span>
      )}
    </div>
  );
}
function InstallmentStatus({ row }: { row: FinanceRow }): ReactElement {
  const badge = installmentVm(row, businessDate(new Date())).badge;
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
