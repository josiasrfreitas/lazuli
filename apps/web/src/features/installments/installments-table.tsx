import type { ReactNode, ReactElement } from "react";
import {
  Badge,
  DataTable,
  TableContainer,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { abbreviatedPersonName } from "~/lib/format";
import { InstallmentAmount } from "./installment-amount";
import { OverduePayerGroupCard, OverdueSearchGuidance } from "./overdue-payer-group";
import { businessDate, installmentVm } from "./view-model";
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

function installmentColumns(today: string): readonly DataTableColumn<FinanceInstallmentRow>[] {
  return [
    {
      id: "selection",
      header: <PaymentSelectionHeaderCheckbox />,
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
type TableState = {
  rows?: FinanceInstallmentRow[] | undefined;
  groups?: FinanceOverduePayerGroup[] | undefined;
  error: boolean;
  filtered: boolean;
  showOverdueSearchGuidance?: boolean;
  onRetry: () => void;
};
function OverdueGroupsBody({
  groups,
  today,
}: {
  groups: FinanceOverduePayerGroup[];
  today: string;
}): ReactNode {
  return (
    <div
      className="w-0 min-w-full space-y-3 overflow-x-hidden pb-3 pr-3"
      data-slot="overdue-payer-groups"
    >
      {groups.map((group) => (
        <OverduePayerGroupCard key={group.payer.id} group={group} today={today} />
      ))}
    </div>
  );
}
export function InstallmentsTable({
  updating,
  footer,
  ...state
}: TableState & { updating: boolean; footer: ReactNode }): ReactElement {
  const today = businessDate(new Date());
  const hasGroups = state.groups !== undefined;
  if (!state.error && hasGroups && (state.groups?.length ?? 0) > 0) {
    return (
      <TableContainer
        viewportBound
        footer={footer}
        className="border-0 bg-transparent"
        aria-busy={updating}
      >
        {state.showOverdueSearchGuidance ? <OverdueSearchGuidance /> : null}
        <OverdueGroupsBody groups={state.groups ?? []} today={today} />
      </TableContainer>
    );
  }
  const rows = hasGroups ? [] : state.rows;
  return (
    <DataTable
      label="Lista de recebíveis"
      columns={installmentColumns(today)}
      state={installmentsState(state, rows)}
      updating={updating}
      footer={footer}
      beforeTable={state.showOverdueSearchGuidance ? <OverdueSearchGuidance /> : undefined}
      onRetry={state.onRetry}
      empty={{
        title: "Nenhum recebível cadastrado",
        description: "Os recebíveis aparecerão aqui quando forem cadastrados.",
      }}
      errorTitle="Não foi possível carregar os recebíveis"
    />
  );
}

function installmentsState(
  state: TableState,
  rows: FinanceInstallmentRow[] | undefined,
): DataTableState<FinanceInstallmentRow & { id: string }> {
  if (state.error) return { kind: "error" };
  if (rows === undefined) return { kind: "loading" };
  if (rows.length === 0) return { kind: state.filtered ? "noResults" : "empty" };
  return { kind: "data", rows: rows.map((row) => ({ ...row, id: row.installmentId })) };
}
