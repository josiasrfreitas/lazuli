import type { ReactElement } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Button,
  DataTable,
  Tabs,
  TabsList,
  TabsTab,
  type DataTableState,
  type TablePaginationConfig,
} from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE } from "@lazuli/validators";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { useStudentFinance, type StudentFinanceState } from "./finance-logic";
import { financeColumns, type FinanceRow } from "./finance-columns";
import { FinanceOverview } from "./finance-overview";
import type { StudentProfile } from "./logic";

export function StudentFinanceSection({ profile }: { profile: StudentProfile }): ReactElement {
  const state = useStudentFinance(profile.id);
  return (
    <div className="grid min-w-0 gap-6">
      <FinanceOverview state={state} profile={profile} />
      <section className="grid min-w-0 gap-3" aria-labelledby="student-charges-heading">
        <FinanceHeading state={state} />
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

function FinanceHeading({ state }: { state: StudentFinanceState }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2
          id="student-charges-heading"
          className="font-display text-xl font-semibold text-heading"
        >
          {state.filter === "overdue" ? "Fila de pendências" : "Histórico de cobranças"}
        </h2>
        <p className="mt-1 text-caption text-muted-foreground">
          {state.filter === "overdue"
            ? "Vencimentos mais antigos primeiro. Registre o recebimento para quitar a pendência."
            : state.filter === "paid"
              ? "Cobranças quitadas deste aluno."
              : "Todas as cobranças vinculadas a este aluno, com seus saldos atuais."}
        </p>
      </div>
      <Tabs value={state.filter} onValueChange={state.setFilter}>
        <TabsList aria-label="Filtrar parcelas">
          <TabsTab value="overdue">
            Pendências{state.summary.data ? ` · ${state.summary.data.overdueCount}` : ""}
          </TabsTab>
          <TabsTab value="all">Todas</TabsTab>
          <TabsTab value="paid">Pagas</TabsTab>
        </TabsList>
      </Tabs>
    </div>
  );
}

function FinanceTable({ state }: { state: StudentFinanceState }): ReactElement {
  if (state.filter === "overdue" && state.data?.total === 0 && !state.query.isError)
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium text-heading">Nenhuma cobrança em atraso</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Os próximos vencimentos e pagamentos anteriores estão no histórico.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="compact-responsive"
          onClick={() => state.setFilter("all")}
        >
          Ver todas as cobranças
        </Button>
      </div>
    );
  return (
    <DataTable
      label={state.filter === "overdue" ? "Cobranças que precisam de ação" : "Parcelas do aluno"}
      columns={financeColumns(
        state.setPayment,
        state.filter === "overdue" ? state.data?.rows[0]?.installmentId : undefined,
      )}
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
  return rows.length > 0
    ? { kind: "data", rows }
    : { kind: state.filter === "all" ? "empty" : "noResults" };
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
