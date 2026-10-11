import type { ReactElement } from "react";
import {
  DataTable,
  Tabs,
  TabsList,
  TabsTab,
  type DataTableState,
  type TablePaginationConfig,
} from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE } from "@lazuli/validators";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { ProfileMetric, ProfileError } from "./profile-shared";
import { useStudentFinance, type StudentFinanceState } from "./finance-logic";
import { financeColumns, type FinanceRow } from "./finance-columns";

export function StudentFinanceSection({ id }: { id: string }): ReactElement {
  const state = useStudentFinance(id);
  return (
    <div className="grid min-w-0 gap-6 pt-6">
      <div>
        <h2 className="text-lg font-semibold">Vida financeira</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cobranças e pagamentos vinculados a este aluno.
        </p>
      </div>
      <FinanceSummary state={state} />
      <section className="grid min-w-0 gap-3">
        <Tabs value={state.filter} onValueChange={state.setFilter}>
          <TabsList aria-label="Filtrar parcelas">
            <TabsTab value="all">Todas</TabsTab>
            <TabsTab value="overdue">Vencidas</TabsTab>
            <TabsTab value="paid">Pagas</TabsTab>
          </TabsList>
        </Tabs>
        <FinanceTable state={state} />
      </section>
      {state.payment && (
        <PaymentDialog
          open
          rows={[state.payment]}
          onOpenChange={(open) => {
            if (!open) state.setPayment(null);
          }}
          onRegistered={state.registered}
        />
      )}
    </div>
  );
}
function FinanceSummary({ state }: { state: StudentFinanceState }): ReactElement {
  if (state.totals.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o resumo financeiro."
        onRetry={() => void state.totals.refetch()}
      />
    );
  return (
    <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <ProfileMetric
        label="Parcelas"
        value={state.totals.data?.counts.all ?? "—"}
        detail="Total de lançamentos"
      />
      <ProfileMetric
        label="Vencidas"
        value={state.totals.data?.counts.overdue ?? "—"}
        detail="Aguardando quitação"
      />
      <ProfileMetric
        label="Pagas"
        value={state.totals.data?.counts.paid ?? "—"}
        detail="Parcelas quitadas"
      />
    </dl>
  );
}
function FinanceTable({ state }: { state: StudentFinanceState }): ReactElement {
  return (
    <DataTable
      label="Parcelas do aluno"
      columns={financeColumns(state.setPayment)}
      state={financeTableState(state)}
      onRetry={() => void state.query.refetch()}
      errorTitle="Não foi possível carregar as parcelas"
      empty={{
        title: "Nenhuma cobrança vinculada",
        description: "As parcelas de contratos e pedidos deste aluno aparecerão aqui.",
      }}
      updating={state.query.isFetching && !state.query.isPending}
      pagination={financePagination(state)}
    />
  );
}
function financeTableState(state: StudentFinanceState): DataTableState<FinanceRow> {
  if (state.query.isError) return { kind: "error" };
  if (!state.data) return { kind: "loading" };
  const rows = state.data.rows.map((row) => ({ ...row, id: row.installmentId }));
  return rows.length
    ? { kind: "data", rows }
    : { kind: state.filter !== "all" ? "noResults" : "empty" };
}
function financePagination(state: StudentFinanceState): TablePaginationConfig {
  const common = {
    page: state.page,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    onPageChange: state.setPage,
    itemLabel: { singular: "parcela", plural: "parcelas" },
  };
  return state.data
    ? { ...common, pageCount: Math.max(1, state.data.pageCount), totalItems: state.data.total }
    : { ...common, loading: true };
}
