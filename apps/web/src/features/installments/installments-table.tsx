import type { ReactNode, ReactElement } from "react";
import {
  Button,
  EmptyState,
  Table,
  TableBody,
  TableContainer,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { OverduePayerGroupCard, OverdueSearchGuidance } from "./overdue-payer-group";
import { businessDate } from "./view-model";
import { COLUMN_IDS, InstallmentRow } from "./installment-row";
function InstallmentsHead(): ReactElement {
  return (
    <TableHeader sticky>
      <TableRow interactive={false}>
        <TableHead id={COLUMN_IDS.installment} className="w-28">
          Sequência
        </TableHead>
        <TableHead id={COLUMN_IDS.origin} className="w-24">
          Origem
        </TableHead>
        <TableHead id={COLUMN_IDS.payer} className="w-28">
          Pagador
        </TableHead>
        <TableHead id={COLUMN_IDS.beneficiaries} className="w-30">
          Beneficiário
        </TableHead>
        <TableHead id={COLUMN_IDS.dueDate} className="w-28">
          Vencimento
        </TableHead>
        <TableHead id={COLUMN_IDS.nominal} className="w-36" numeric>
          Valor nominal
        </TableHead>
        <TableHead id={COLUMN_IDS.paid} className="w-32" numeric>
          Valor pago
        </TableHead>
        <TableHead id={COLUMN_IDS.status} className="w-40">
          Situação
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
const COLUMN_COUNT = 8;
const NOMINAL_COLUMN_INDEX = 5;
const PAID_COLUMN_INDEX = 6;
const NUMERIC_COLUMNS = [NOMINAL_COLUMN_INDEX, PAID_COLUMN_INDEX];
const SKELETON_ROWS = 10;
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
          title="Não foi possível carregar os recebíveis"
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
          title={filtered ? "Nenhum recebível encontrado" : "Nenhum recebível cadastrado"}
          description={
            filtered
              ? "Ajuste a busca ou o filtro de situação."
              : "Os recebíveis aparecerão aqui quando forem cadastrados."
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
  return (
    <TableContainer viewportBound footer={footer}>
      {state.showOverdueSearchGuidance ? <OverdueSearchGuidance /> : null}
      <Table
        aria-label="Lista de recebíveis"
        aria-busy={updating}
        className="min-w-240 table-fixed"
      >
        <InstallmentsHead />
        <TableBody>
          <InstallmentsBody {...state} rows={hasGroups ? [] : state.rows} today={today} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}
