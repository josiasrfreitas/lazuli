import { useState, type ReactElement } from "react";
import { Handshake, TriangleAlert } from "lucide-react";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
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
import { visibleFinanceContracts } from "./finance-contract-terms";
import { ContractTerminationDialog } from "./contract-termination-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import type { StudentProfile } from "./logic";

export function StudentFinanceSection({
  id,
  profile,
}: {
  id: string;
  profile?: StudentProfile | undefined;
}): ReactElement {
  const state = useStudentFinance(id);
  const [terminationId, setTerminationId] = useState<string | null>(null);
  const [treatmentIds, setTreatmentIds] = useState<string[] | null>(null);
  return (
    <div className="grid min-w-0 gap-6">
      <FinanceOverview state={state} profile={profile} />
      <section className="grid min-w-0 gap-3" aria-labelledby="student-charges-heading">
        <FinanceHeading
          state={state}
          onTreat={() => setTreatmentIds([])}
          onTerminate={setTerminationId}
        />
        <FinanceTable state={state} onTreat={(row) => setTreatmentIds([row.installmentId])} />
      </section>
      {terminationId && (
        <ContractTerminationDialog
          contractId={terminationId}
          onClose={() => setTerminationId(null)}
        />
      )}
      {treatmentIds && (
        <TreatmentDialog
          studentId={id}
          initialIds={treatmentIds}
          onClose={() => setTreatmentIds(null)}
        />
      )}
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

function FinanceHeading({
  state,
  onTreat,
  onTerminate,
}: {
  state: StudentFinanceState;
  onTreat: () => void;
  onTerminate: (contractId: string) => void;
}): ReactElement {
  const contracts = state.summary.data ? visibleFinanceContracts(state.summary.data) : [];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <FinanceHeadingCopy filter={state.filter} />
      <div className="flex flex-wrap items-center gap-3">
        {contracts.map((contract) => (
          <Button
            key={contract.id}
            variant="destructive-ghost"
            size="sm"
            onClick={() => onTerminate(contract.id)}
          >
            <TriangleAlert aria-hidden="true" /> Rescindir contrato
            {contracts.length > 1 && contract.startsOn
              ? ` · ${formatDateOnlyBR(contract.startsOn)}`
              : ""}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onTreat}>
          <Handshake aria-hidden="true" /> Negociar parcelas
        </Button>
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
    </div>
  );
}

function FinanceHeadingCopy({ filter }: { filter: StudentFinanceState["filter"] }): ReactElement {
  let description = "Todas as cobranças vinculadas a este aluno, com seus saldos atuais.";
  if (filter === "overdue")
    description =
      "Vencimentos mais antigos primeiro. Registre o recebimento para quitar a pendência.";
  else if (filter === "paid") description = "Cobranças quitadas deste aluno.";
  return (
    <div>
      <h2 id="student-charges-heading" className="font-display text-xl font-semibold text-heading">
        {filter === "overdue" ? "Fila de pendências" : "Histórico de cobranças"}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">{description}</p>
    </div>
  );
}

function FinanceTable({
  state,
  onTreat,
}: {
  state: StudentFinanceState;
  onTreat: (row: FinanceRow) => void;
}): ReactElement {
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
      columns={financeColumns({
        onReceive: state.setPayment,
        priorityId: state.filter === "overdue" ? state.data?.rows[0]?.installmentId : undefined,
        onTreat,
      })}
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
