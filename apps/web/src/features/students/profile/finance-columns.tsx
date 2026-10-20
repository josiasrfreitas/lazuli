import { DollarSign, Handshake } from "lucide-react";
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
    width: "standard",
    cell: (row) => <InstallmentDue row={row} />,
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
  { onTreat, priorityId }: { onTreat: (row: FinanceRow) => void; priorityId: string | undefined },
): DataTableColumn<FinanceRow>[] {
  return [
    ...COLUMNS,
    {
      id: "action",
      header: <span className="sr-only">Ações</span>,
      width: "standard",
      cell: (row) =>
        row.collectibleBalanceCents > 0 ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant={row.installmentId === priorityId ? "primary" : "secondary"}
              onClick={() => onReceive(row)}
              aria-label={`Receber parcela ${row.sequenceNumber} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
            >
              <DollarSign aria-hidden="true" /> Receber
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onTreat(row)}
              aria-label={`Negociar parcela ${row.sequenceNumber} com vencimento em ${formatDateOnlyBR(row.dueDate)}`}
            >
              <Handshake aria-hidden />
            </Button>
          </div>
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

function InstallmentDue({ row }: { row: FinanceRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span>{formatDateOnlyBR(row.dueDate)}</span>
      {row.status === "OVERDUE" && (
        <span className="text-caption text-destructive">{row.overdueDays} dias em atraso</span>
      )}
    </div>
  );
}

function InstallmentAmounts({ row }: { row: FinanceRow }): ReactElement {
  return (
    <div className="grid gap-1">
      <span>{money(row.expectedAmountCents)}</span>
      {row.originalAmountCents !== row.expectedAmountCents && (
        <span className="text-caption text-muted-foreground">
          Original {money(row.originalAmountCents)}
        </span>
      )}
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
