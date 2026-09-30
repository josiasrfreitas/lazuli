"use client";
import { createContext, useContext, type ReactElement } from "react";
import { Checkbox, TableCell, TableHead } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
export type PaymentSelection = {
  rows: FinanceInstallmentRow[];
  visible: FinanceInstallmentRow[];
  toggle: (row: FinanceInstallmentRow) => void;
  toggleVisible: () => void;
};
export const PaymentSelectionContext = createContext<PaymentSelection | null>(null);
export function toggleSelected(
  rows: FinanceInstallmentRow[],
  row: FinanceInstallmentRow,
): FinanceInstallmentRow[] {
  if (rows.some((item) => item.installmentId === row.installmentId))
    return rows.filter((item) => item.installmentId !== row.installmentId);
  return row.collectibleBalanceCents > 0 ? [...rows, row] : rows;
}
export function toggleVisibleSelection(
  rows: FinanceInstallmentRow[],
  visible: FinanceInstallmentRow[],
): FinanceInstallmentRow[] {
  const eligible = visible.filter((row) => row.collectibleBalanceCents > 0);
  const selected = new Set(rows.map((row) => row.installmentId));
  const allSelected = eligible.every((row) => selected.has(row.installmentId));
  const visibleIds = new Set(eligible.map((row) => row.installmentId));
  return allSelected
    ? rows.filter((row) => !visibleIds.has(row.installmentId))
    : [...rows, ...eligible.filter((row) => !selected.has(row.installmentId))];
}
export function PaymentSelectionCheckbox({
  row,
}: {
  row: FinanceInstallmentRow;
}): ReactElement | null {
  const selection = useContext(PaymentSelectionContext);
  if (!selection) return null;
  return (
    <Checkbox
      aria-label={`Selecionar ${row.payer.name}, parcela ${row.sequenceNumber}, vencimento ${row.dueDate}`}
      checked={selection.rows.some((item) => item.installmentId === row.installmentId)}
      disabled={row.collectibleBalanceCents <= 0}
      onCheckedChange={() => selection.toggle(row)}
    />
  );
}
export function PaymentSelectionHeaderCheckbox(): ReactElement | null {
  const selection = useContext(PaymentSelectionContext);
  if (!selection) return null;
  const eligible = selection.visible.filter((row) => row.collectibleBalanceCents > 0);
  const count = eligible.filter((row) =>
    selection.rows.some((item) => item.installmentId === row.installmentId),
  ).length;
  return (
    <Checkbox
      aria-label="Selecionar recebíveis visíveis"
      disabled={eligible.length === 0}
      checked={count > 0 && count === eligible.length}
      indeterminate={count > 0 && count < eligible.length}
      onCheckedChange={selection.toggleVisible}
    />
  );
}

export function PaymentSelectionCell({ row }: { row: FinanceInstallmentRow }): ReactElement {
  return (
    <TableCell>
      <PaymentSelectionCheckbox row={row} />
    </TableCell>
  );
}
export function PaymentSelectionHead(): ReactElement {
  return (
    <TableHead className="w-10">
      <PaymentSelectionHeaderCheckbox />
    </TableHead>
  );
}
