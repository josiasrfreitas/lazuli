import { Badge, type DataTableColumn } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { abbreviatedPersonName } from "~/lib/format";
import { InstallmentAmount } from "./installment-amount";
import { installmentVm } from "./view-model";
import { PaymentSelectionCheckbox, PaymentSelectionHeaderCheckbox } from "./payment/selection";

const COLUMN_WIDTHS = {
  selection: "selection",
  sequence: "narrow",
  origin: "narrow",
  payer: "standard",
  beneficiaries: "standard",
  dueDate: "narrow",
  nominal: "standard",
  paid: "standard",
  status: "standard",
} as const satisfies Record<string, NonNullable<DataTableColumn<FinanceInstallmentRow>["width"]>>;

const columns: readonly DataTableColumn<FinanceInstallmentRow>[] = [
  {
    id: "selection",
    header: createElement(PaymentSelectionHeaderCheckbox),
    width: COLUMN_WIDTHS.selection,
    cell: (row) => <PaymentSelectionCheckbox row={row} />,
  },
  {
    id: "sequence",
    header: "Sequência",
    width: COLUMN_WIDTHS.sequence,
    cell: (row) => (
      <span className="font-numeric whitespace-nowrap tabular-nums">
        {installmentVm(row, "").sequence}
      </span>
    ),
  },
  {
    id: "origin",
    header: "Origem",
    width: COLUMN_WIDTHS.origin,
    cell: (row) => installmentVm(row, "").origin,
  },
  {
    id: "payer",
    header: "Pagador",
    width: COLUMN_WIDTHS.payer,
    cell: (row) => <span className="break-words">{row.payer.name}</span>,
  },
  {
    id: "beneficiaries",
    header: "Beneficiário",
    width: COLUMN_WIDTHS.beneficiaries,
    cell: (row) => (
      <span className="break-words">
        {row.beneficiaries.map((person) => abbreviatedPersonName(person.fullName)).join(", ") ||
          "—"}
      </span>
    ),
  },
  {
    id: "dueDate",
    header: "Vencimento",
    width: COLUMN_WIDTHS.dueDate,
    cell: (row) => (
      <span className="font-numeric tabular-nums">{installmentVm(row, "").dueDate}</span>
    ),
  },
  {
    id: "nominal",
    header: "Valor nominal",
    width: COLUMN_WIDTHS.nominal,
    numeric: true,
    cell: (row) => <InstallmentAmount row={row} column="nominal" />,
  },
  {
    id: "paid",
    header: "Valor pago",
    width: COLUMN_WIDTHS.paid,
    numeric: true,
    cell: (row) => <InstallmentAmount row={row} column="paid" />,
  },
];

export function installmentColumns(
  today: string,
): readonly DataTableColumn<FinanceInstallmentRow>[] {
  return [
    ...columns,
    {
      id: "status",
      header: "Situação",
      width: COLUMN_WIDTHS.status,
      cell: (row) => {
        const { badge } = installmentVm(row, today);
        return (
          <Badge variant={badge.variant} title={badge.description} className="whitespace-normal">
            {badge.label}
          </Badge>
        );
      },
    },
  ];
}
import { createElement } from "react";
