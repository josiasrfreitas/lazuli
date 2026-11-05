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
import type {
  FinanceInstallmentRow,
  FinanceOverduePayerGroup,
  FinancePayerGroup,
} from "@lazuli/validators";
import { InstallmentRowActions } from "./installment-actions";
import {
  abbreviatedPersonName,
  firstTwoNames,
  formatBRLFromCents,
  formatDateOnlyBR,
} from "~/lib/format";
import {
  businessDate,
  installmentAmountVm,
  installmentVm,
  overduePayerSummaryVm,
} from "./view-model";
import { installmentColumnMode, type InstallmentSituation } from "./column-policy";
import { PaymentSelectionCheckbox, PaymentSelectionHeaderCheckbox } from "./payment/selection";

type PayerGroup = FinanceOverduePayerGroup | FinancePayerGroup;

function isRowControl(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("a, button, input, select, textarea, [role='button'], [role='checkbox']"),
    )
  );
}

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

function installmentIdentityColumns(grouped: boolean): DataTableColumn<FinanceInstallmentRow>[] {
  return [
    {
      id: "sequence",
      header: "Sequência",
      width: "narrow",
      cell: (row) => (
        <span className="font-numeric whitespace-nowrap tabular-nums">
          {installmentVm(row, "").sequence}
        </span>
      ),
    },
    {
      id: "origin",
      header: "Origem",
      width: "narrow",
      cell: (row) => installmentVm(row, "").origin,
    },
    ...(!grouped
      ? [
          {
            id: "payer",
            header: "Pagador",
            width: "standard" as const,
            cell: (row: FinanceInstallmentRow) => (
              <span className="break-words" title={row.payer.name}>
                {firstTwoNames(row.payer.name)}
              </span>
            ),
          },
        ]
      : []),
    {
      id: "beneficiaries",
      header: "Beneficiário",
      width: "standard",
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
      width: "narrow",
      cell: (row) => (
        <span className="font-numeric whitespace-nowrap tabular-nums">
          {installmentVm(row, "").dueDate}
        </span>
      ),
    },
  ];
}

export function installmentColumns(
  today: string,
  situations: readonly InstallmentSituation[],
  grouped = false,
): readonly DataTableColumn<FinanceInstallmentRow>[] {
  const mode = installmentColumnMode(situations);
  return [
    ...(mode === "paid" || mode === "waived"
      ? []
      : [
          {
            id: "selection",
            header: <PaymentSelectionHeaderCheckbox />,
            width: "selection" as const,
            cell: (row: FinanceInstallmentRow) => <PaymentSelectionCheckbox row={row} />,
          },
        ]),
    ...installmentIdentityColumns(grouped),
    {
      id: "nominal",
      header: "Valor nominal",
      width: "standard",
      numeric: true,
      cell: (row) => <InstallmentAmount row={row} column="nominal" />,
    },
    ...(mode === "standard" || mode === "paid"
      ? [
          {
            id: "paid",
            header: "Valor pago",
            width: "standard" as const,
            numeric: true,
            cell: (row: FinanceInstallmentRow) => <InstallmentAmount row={row} column="paid" />,
          },
        ]
      : []),
    ...(mode === "paid"
      ? [
          {
            id: "paidOn",
            header: "Data do pagamento",
            width: "narrow" as const,
            cell: (row: FinanceInstallmentRow) => (
              <span className="font-numeric whitespace-nowrap tabular-nums">
                {formatDateOnlyBR(row.paidOn ?? undefined)}
              </span>
            ),
          },
        ]
      : []),
    ...(mode === "standard"
      ? [
          {
            id: "status",
            header: "Situação",
            width: "standard" as const,
            cell: (row: FinanceInstallmentRow) => {
              const { badge } = installmentVm(row, today);
              return (
                <Badge
                  variant={badge.variant}
                  title={badge.description}
                  className="whitespace-normal"
                >
                  {badge.label}
                </Badge>
              );
            },
          },
        ]
      : []),
    {
      id: "actions",
      header: "Ações",
      width: "standard",
      numeric: true,
      cell: (row) => <InstallmentRowActions row={row} />,
    },
  ];
}

function PayerGroupHeader({ group, paid }: { group: PayerGroup; paid: boolean }): ReactElement {
  const summary =
    "paidAmountCents" in group
      ? `${group.installmentCount} ${group.installmentCount === 1 ? "parcela" : "parcelas"} · ${group.beneficiaries.length} ${group.beneficiaries.length === 1 ? "aluno" : "alunos"}`
      : overduePayerSummaryVm(group).description;
  const amount =
    paid && "paidAmountCents" in group ? group.paidAmountCents : group.collectibleBalanceCents;
  const waived = group.rows.every((row) => row.status === "WAIVED");
  const total = waived
    ? group.rows.reduce(
        (sum, row) => sum + Math.max(row.expectedAmountCents - row.paidAmountCents, 0),
        0,
      )
    : amount;
  const headingId = `installments-payer-${group.payer.id}`;
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-muted px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar aria-hidden colorKey={group.payer.id} name={group.payer.name} size="sm" />
        <div className="min-w-0">
          <h2
            id={headingId}
            className="break-words font-display font-semibold text-foreground"
            title={group.payer.name}
          >
            {firstTwoNames(group.payer.name)}
          </h2>
          <p id={`${headingId}-summary`} className="text-xs text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>
      <div className="w-full shrink-0 text-right sm:ml-auto sm:w-auto">
        <span className="block text-xs text-muted-foreground">
          {paid ? "Total pago" : waived ? "Total dispensado" : "Saldo em aberto"}
        </span>
        <strong
          className={`font-numeric block font-semibold tabular-nums ${paid ? "text-success" : waived ? "text-muted-foreground" : "text-destructive"}`}
        >
          {formatBRLFromCents(total)}
        </strong>
      </div>
    </header>
  );
}

function columnWidth(column: { width?: DataTableColumn<FinanceInstallmentRow>["width"] }): string {
  if (column.width === "selection") return "w-10";
  if (column.width === "narrow") return "w-28";
  if (column.width === "medium") return "w-48";
  if (column.width === "wide") return "w-60";
  return "w-36";
}

function PayerGroupCard({
  group,
  columns,
  paid,
  onRowClick,
}: {
  group: PayerGroup;
  columns: readonly DataTableColumn<FinanceInstallmentRow & { id: string }>[];
  paid: boolean;
  onRowClick?: ((row: FinanceInstallmentRow) => void) | undefined;
}): ReactElement {
  const groupId = `installments-payer-${group.payer.id}`;
  return (
    <section
      aria-labelledby={groupId}
      className="contain-paint overflow-hidden rounded-lg border border-border bg-card"
      data-payer-id={group.payer.id}
      data-slot={"paidAmountCents" in group ? "payer-group" : "overdue-payer-group"}
    >
      <PayerGroupHeader group={group} paid={paid} />
      <div className="overflow-x-auto scrollbar-subtle">
        <Table
          aria-labelledby={groupId}
          aria-describedby={`${groupId}-summary`}
          className="w-full min-w-4xl table-fixed"
          density="compact"
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} className={columnWidth(column)} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow interactive={false}>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  id={`${groupId}-column-${column.id}`}
                  scope="col"
                  {...(column.numeric === undefined ? {} : { numeric: column.numeric })}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rows.map((row) => {
              const displayRow = { ...row, id: row.installmentId };
              return (
                <TableRow
                  key={row.installmentId}
                  interactive={Boolean(onRowClick)}
                  className={
                    onRowClick
                      ? "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if (event.defaultPrevented || isRowControl(event.target)) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" && !isRowControl(event.target)) {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      headers={`${groupId}-column-${column.id}`}
                      {...(column.numeric === undefined ? {} : { numeric: column.numeric })}
                    >
                      {column.cell(displayRow)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function PayerGroupsBody({
  groups,
  columns,
  paid,
  onRowClick,
}: {
  groups: PayerGroup[];
  columns: readonly DataTableColumn<FinanceInstallmentRow & { id: string }>[];
  paid: boolean;
  onRowClick?: ((row: FinanceInstallmentRow) => void) | undefined;
}): ReactNode {
  return (
    <div
      className="w-0 min-w-full space-y-3 overflow-x-hidden pb-3 pr-3"
      data-slot={
        groups[0] && "paidAmountCents" in groups[0] ? "payer-groups" : "overdue-payer-groups"
      }
    >
      {groups.map((group) => (
        <PayerGroupCard
          key={group.payer.id}
          group={group}
          columns={columns}
          paid={paid}
          onRowClick={onRowClick}
        />
      ))}
    </div>
  );
}

type TableState = {
  rows?: FinanceInstallmentRow[] | undefined;
  groups?: PayerGroup[] | undefined;
  situations?: readonly InstallmentSituation[];
  error: boolean;
  filtered: boolean;
  showGroupedSearchGuidance?: boolean;
  showOverdueSearchGuidance?: boolean;
  onRowClick?: ((row: FinanceInstallmentRow) => void) | undefined;
  onRetry: () => void;
};

export function InstallmentsTable({
  updating,
  footer,
  ...state
}: TableState & { updating: boolean; footer: ReactNode }): ReactElement {
  const today = businessDate(new Date());
  const situations = state.situations ?? [];
  const columns = installmentColumns(today, situations, state.groups !== undefined);
  const paid = installmentColumnMode(situations) === "paid";
  const guidance =
    state.showGroupedSearchGuidance || state.showOverdueSearchGuidance ? (
      <p className="shrink-0 px-5 py-3 text-sm text-muted-foreground">
        {state.showOverdueSearchGuidance
          ? "Exibindo todas as parcelas vencidas dos pagadores encontrados."
          : "Exibindo as parcelas filtradas dos pagadores encontrados."}
      </p>
    ) : undefined;
  if (!state.error && state.groups && state.groups.length > 0) {
    return (
      <TableContainer
        viewportBound
        footer={footer}
        className="border-0 bg-transparent"
        aria-busy={updating}
      >
        {guidance}
        <PayerGroupsBody
          groups={state.groups}
          columns={columns}
          paid={paid}
          onRowClick={state.onRowClick}
        />
      </TableContainer>
    );
  }
  const rows = state.groups ? [] : state.rows;
  return (
    <DataTable<FinanceInstallmentRow & { id: string }>
      label="Lista de recebíveis"
      columns={columns}
      {...(state.onRowClick ? { onRowClick: state.onRowClick } : {})}
      state={installmentsState(state, rows)}
      updating={updating}
      footer={footer}
      beforeTable={guidance}
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
