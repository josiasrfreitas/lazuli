import type { ReactNode, ReactElement } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { OverduePayerGroupCard } from "./overdue-payer-group";
import { abbreviatedPersonName, businessDate, installmentVm } from "./view-model";
const COLUMN_IDS = {
  installment: "installments-column-installment",
  payer: "installments-column-payer",
  beneficiaries: "installments-column-beneficiaries",
  dueDate: "installments-column-due-date",
  amount: "installments-column-amount",
  status: "installments-column-status",
} as const;
function InstallmentRow({
  row,
  today,
}: {
  row: FinanceInstallmentRow;
  today: string;
}): ReactElement {
  const vm = installmentVm(row, today);
  return (
    <TableRow>
      <TableCell headers={COLUMN_IDS.installment}>
        <span className="font-numeric tabular-nums">{vm.sequence}</span>
      </TableCell>
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
      <TableCell headers={COLUMN_IDS.amount} numeric>
        <span className="font-numeric tabular-nums">{vm.amount}</span>
        {vm.balance === null ? null : (
          <p className="font-numeric text-xs tabular-nums text-muted-foreground">{vm.balance}</p>
        )}
      </TableCell>
      <TableCell headers={COLUMN_IDS.status}>
        <Badge className="whitespace-nowrap" variant={vm.badge.variant}>
          {vm.badge.label}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
function InstallmentsHead(): ReactElement {
  return (
    <TableHeader sticky>
      <TableRow>
        <TableHead id={COLUMN_IDS.installment} className="w-1/12">
          Parcela
        </TableHead>
        <TableHead id={COLUMN_IDS.payer} className="w-2/12">
          Pagador
        </TableHead>
        <TableHead id={COLUMN_IDS.beneficiaries} className="w-2/12">
          Beneficiário(s)
        </TableHead>
        <TableHead id={COLUMN_IDS.dueDate} className="w-2/12">
          Vencimento
        </TableHead>
        <TableHead id={COLUMN_IDS.amount} className="w-3/12" numeric>
          Valor
        </TableHead>
        <TableHead id={COLUMN_IDS.status} className="w-2/12">
          Status
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
type TableState = {
  rows?: FinanceInstallmentRow[] | undefined;
  groups?: FinanceOverduePayerGroup[] | undefined;
  error: boolean;
  filtered: boolean;
  showOverdueSearchGuidance?: boolean;
  onRetry: () => void;
};
const COLUMN_COUNT = 6;
const AMOUNT_COLUMN_INDEX = 4;
const NUMERIC_COLUMNS = [AMOUNT_COLUMN_INDEX];
const SKELETON_ROWS = 10;
function OverdueSearchGuidance(): ReactElement {
  return (
    <p className="shrink-0 px-5 py-3 text-sm text-muted-foreground">
      Exibindo todas as parcelas vencidas dos pagadores encontrados.
    </p>
  );
}
function InstallmentsBody({
  rows,
  error,
  filtered,
  onRetry,
  today,
}: TableState & { today: string }): ReactNode {
  if (error)
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          title="Não foi possível carregar as parcelas"
          description="Verifique a conexão e tente de novo."
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Tentar de novo
            </Button>
          }
        />
      </TableEmpty>
    );
  if (rows === undefined)
    return (
      <TableSkeleton columns={COLUMN_COUNT} numericColumns={NUMERIC_COLUMNS} rows={SKELETON_ROWS} />
    );
  if (rows.length === 0)
    return (
      <TableEmpty colSpan={COLUMN_COUNT}>
        <EmptyState
          title={filtered ? "Nenhuma parcela encontrada" : "Nenhuma parcela cadastrada"}
          description={
            filtered
              ? "Ajuste a busca ou o filtro de status."
              : "As parcelas aparecerão aqui quando forem cadastradas."
          }
        />
      </TableEmpty>
    );
  return rows.map((row) => <InstallmentRow key={row.installmentId} row={row} today={today} />);
}

function OverdueGroupsBody({
  groups,
  today,
}: {
  groups: FinanceOverduePayerGroup[];
  today: string;
}): ReactNode {
  return (
    <div
      className="w-0 min-w-full space-y-3 overflow-x-hidden pb-3"
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
  return (
    <TableContainer viewportBound footer={footer}>
      {state.showOverdueSearchGuidance ? <OverdueSearchGuidance /> : null}
      <Table aria-label="Lista de parcelas" aria-busy={updating} className="min-w-4xl table-fixed">
        <InstallmentsHead />
        <TableBody>
          <InstallmentsBody {...state} rows={hasGroups ? [] : state.rows} today={today} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}
