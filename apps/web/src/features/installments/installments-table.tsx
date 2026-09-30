import type { ReactNode, ReactElement } from "react";
import { DataTable, TableContainer, type DataTableState } from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";
import { OverduePayerGroupCard, OverdueSearchGuidance } from "./overdue-payer-group";
import { businessDate } from "./view-model";
import { installmentColumns } from "./installment-columns";
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
