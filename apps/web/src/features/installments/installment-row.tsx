import type { ReactElement } from "react";
import { Badge, TableCell, TableRow } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { abbreviatedPersonName } from "~/lib/format";
import { InstallmentAmount } from "./installment-amount";
import { installmentVm } from "./view-model";

export const COLUMN_IDS = {
  installment: "installments-column-installment",
  origin: "installments-column-origin",
  payer: "installments-column-payer",
  beneficiaries: "installments-column-beneficiaries",
  dueDate: "installments-column-due-date",
  nominal: "installments-column-nominal",
  paid: "installments-column-paid",
  status: "installments-column-status",
} as const;

export function InstallmentRow({
  row,
  today,
}: {
  row: FinanceInstallmentRow;
  today: string;
}): ReactElement {
  const vm = installmentVm(row, today);
  return (
    <TableRow interactive={false}>
      <TableCell headers={COLUMN_IDS.installment}>
        <span className="font-numeric whitespace-nowrap tabular-nums">{vm.sequence}</span>
      </TableCell>
      <TableCell headers={COLUMN_IDS.origin}>{vm.origin}</TableCell>
      <TableCell headers={COLUMN_IDS.payer} className="break-words">
        {row.payer.name}
      </TableCell>
      <TableCell headers={COLUMN_IDS.beneficiaries} className="break-words">
        {row.beneficiaries.map((person) => abbreviatedPersonName(person.fullName)).join(", ") ||
          "—"}
      </TableCell>
      <TableCell headers={COLUMN_IDS.dueDate}>
        <span className="font-numeric tabular-nums">{vm.dueDate}</span>
      </TableCell>
      <TableCell headers={COLUMN_IDS.nominal} numeric>
        <InstallmentAmount row={row} column="nominal" />
      </TableCell>
      <TableCell headers={COLUMN_IDS.paid} numeric>
        <InstallmentAmount row={row} column="paid" />
      </TableCell>
      <TableCell headers={COLUMN_IDS.status}>
        <Badge
          variant={vm.badge.variant}
          title={vm.badge.description}
          className="whitespace-nowrap"
        >
          {vm.badge.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
