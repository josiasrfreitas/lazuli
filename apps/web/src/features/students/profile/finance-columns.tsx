import type { ReactElement } from "react";
import { Badge, Button, type DataTableColumn } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import { installmentVm, businessDate, originLabel } from "~/features/installments/view-model";
export type FinanceRow = FinanceInstallmentRow & { id: string };
const COLUMNS: DataTableColumn<FinanceRow>[] = [
  {
    id: "origin",
    header: "Cobrança / pagador",
    width: "wide",
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
    width: "standard",
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
export function financeColumns(
  onReceive: (row: FinanceRow) => void,
): DataTableColumn<FinanceRow>[] {
  return [
    ...COLUMNS,
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "narrow",
      cell: (row) =>
        row.collectibleBalanceCents > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReceive(row)}
            aria-label={`Receber parcela ${row.sequenceNumber} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
          >
            Receber
          </Button>
        ) : null,
    },
  ];
}
function InstallmentIdentity({ row }: { row: FinanceRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span className="font-medium">
        {originLabel(row.origin)} · {row.sequenceNumber}/{row.scheduleTotal}
      </span>
      <span className="text-caption text-muted-foreground">{row.payer.name}</span>
      {row.beneficiaries.length > 1 && (
        <span className="text-caption text-muted-foreground">
          Compartilhada entre {row.beneficiaries.length} alunos · valor integral
        </span>
      )}
    </div>
  );
}
function InstallmentAmounts({ row }: { row: FinanceRow }): ReactElement {
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
function InstallmentStatus({ row }: { row: FinanceRow }): ReactElement {
  const badge = installmentVm(row, businessDate(new Date())).badge;
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
