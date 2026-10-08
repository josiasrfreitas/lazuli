import type { ReactNode, ReactElement } from "react";
import { BadgePercent } from "lucide-react";
import {
  Avatar,
  Badge,
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableContainer,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { abbreviatedPersonName } from "~/lib/format";
import {
  businessDate,
  installmentAmountVm,
  installmentVm,
  overduePayerSummaryVm,
} from "./view-model";
import {
  PaymentSelectionCell,
  PaymentSelectionCheckbox,
  PaymentSelectionHead,
  PaymentSelectionHeaderCheckbox,
} from "./payment/selection";

function InstallmentAmount({
  row,
  column,
}: {
  row: FinanceInstallmentRow;
  column: "nominal" | "paid";
}): ReactElement {
  const amount = installmentAmountVm(row);
  const description = column === "paid" ? amount.discount : null;
  const formattedValue = column === "nominal" ? amount.nominal : amount.paid;
  const value = (
    <span className="font-numeric inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
      {formattedValue}
      {description === null ? null : (
        <BadgePercent aria-hidden="true" className="size-3.5 text-muted-foreground" />
      )}
    </span>
  );
  if (description === null) return value;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-label={`${formattedValue}. ${description}`}
              className="inline-flex"
            >
              {value}
            </span>
          }
        />
        <TooltipContent side="top">{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const OVERDUE_COLUMNS = [
  { key: "installment", label: "Sequência" },
  { key: "origin", label: "Origem" },
  { key: "beneficiaries", label: "Beneficiário" },
  { key: "due-date", label: "Vencimento" },
  { key: "nominal", label: "Valor nominal" },
  { key: "paid", label: "Valor pago" },
  { key: "status", label: "Atraso" },
] as const;

function beneficiaryNames(row: FinanceInstallmentRow): string {
  const names = row.beneficiaries.map((person) => person.fullName);
  if (names.length < 2) return names[0] ?? "—";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

function OverdueInstallmentRow({
  row,
  today,
  groupHeadingId,
}: {
  row: FinanceInstallmentRow;
  today: string;
  groupHeadingId: string;
}): ReactElement {
  const vm = installmentVm(row, today);
  return (
    <TableRow interactive={false}>
      <PaymentSelectionCell row={row} />
      <TableCell headers={`${groupHeadingId}-column-installment`}>
        <span className="font-numeric whitespace-nowrap tabular-nums">{vm.sequence}</span>
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-origin`}>{vm.origin}</TableCell>
      <TableCell headers={`${groupHeadingId}-column-beneficiaries`} className="break-words">
        {beneficiaryNames(row)}
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-due-date`}>
        <span className="font-numeric whitespace-nowrap tabular-nums">{vm.dueDate}</span>
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-nominal`} numeric>
        <InstallmentAmount row={row} column="nominal" />
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-paid`} numeric>
        <InstallmentAmount row={row} column="paid" />
      </TableCell>
      <TableCell headers={`${groupHeadingId}-column-status`} numeric>
        <Badge variant="destructive" className="whitespace-normal">
          {row.paidAmountCents > 0 ? "Parcial · " : ""}
          {row.overdueDays} {row.overdueDays === 1 ? "dia" : "dias"}
        </Badge>
      </TableCell>
    </TableRow>
  );
}

function OverdueGroupHeader({
  group,
  headingId,
}: {
  group: FinanceOverduePayerGroup;
  headingId: string;
}): ReactElement {
  const vm = overduePayerSummaryVm(group);
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-muted px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar aria-hidden colorKey={group.payer.id} name={group.payer.name} size="sm" />
        <div className="min-w-0">
          <h2 id={headingId} className="break-words font-display font-semibold text-foreground">
            {group.payer.name}
          </h2>
          <p id={`${headingId}-summary`} className="text-xs text-muted-foreground">
            {vm.description}
          </p>
        </div>
      </div>
      <div className="w-full shrink-0 text-right sm:ml-auto sm:w-auto">
        <span className="block text-xs text-muted-foreground">Saldo em aberto</span>
        <strong className="font-numeric block font-semibold tabular-nums text-destructive">
          {vm.balance}
        </strong>
      </div>
    </header>
  );
}

function OverdueInstallmentsHead({ groupHeadingId }: { groupHeadingId: string }): ReactElement {
  return (
    <TableHeader>
      <TableRow interactive={false}>
        <PaymentSelectionHead />
        {OVERDUE_COLUMNS.map((column) => (
          <TableHead
            id={`${groupHeadingId}-column-${column.key}`}
            key={column.key}
            scope="col"
            numeric={column.key === "nominal" || column.key === "paid" || column.key === "status"}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function OverduePayerGroupCard({
  group,
  today,
}: {
  group: FinanceOverduePayerGroup;
  today: string;
}): ReactElement {
  const groupId = `installments-payer-${group.payer.id}`;
  return (
    <section
      aria-labelledby={groupId}
      className="contain-paint overflow-hidden rounded-lg border border-border bg-card"
      data-payer-id={group.payer.id}
      data-slot="overdue-payer-group"
    >
      <OverdueGroupHeader group={group} headingId={groupId} />
      <div className="overflow-x-auto scrollbar-subtle">
        <Table
          aria-labelledby={groupId}
          aria-describedby={`${groupId}-summary`}
          className="w-full table-fixed"
          density="compact"
        >
          <colgroup>
            <col className="w-10" />
            <col className="w-24" />
            <col className="w-28" />
            <col />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
          </colgroup>
          <OverdueInstallmentsHead groupHeadingId={groupId} />
          <TableBody>
            {group.rows.map((row) => (
              <OverdueInstallmentRow
                key={row.installmentId}
                row={row}
                today={today}
                groupHeadingId={groupId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function OverdueSearchGuidance(): ReactElement {
  return (
    <p className="shrink-0 px-5 py-3 text-sm text-muted-foreground">
      Exibindo todas as parcelas vencidas dos pagadores encontrados.
    </p>
  );
}

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
