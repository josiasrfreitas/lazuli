import { useState, type ReactElement } from "react";
import { Handshake, FilePenLine, Ellipsis } from "lucide-react";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
import { CheckCircle2 } from "lucide-react";
import {
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type DataTableState,
  type TablePaginationConfig,
} from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE } from "@lazuli/validators";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { useStudentFinance, type StudentFinanceState } from "./finance-logic";
import { financeColumns, type FinanceRow } from "./finance-columns";
import { FinanceOverview } from "./finance-overview";
import { visibleFinanceContracts } from "./finance-contract-terms";
import { ContractRenegotiationDialog } from "./contract-renegotiation-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import type { StudentProfile } from "./logic";
import styles from "./finance-overview.module.css";

export function StudentFinanceSection({
  id,
  profile,
  summary,
}: {
  id: string;
  profile?: StudentProfile | undefined;
  summary?: StudentFinanceState["summary"] | undefined;
}): ReactElement {
  const state = useStudentFinance(id, summary);
  const [contractId, setContractId] = useState<string | null>(null);
  const [treatmentIds, setTreatmentIds] = useState<string[] | null>(null);
  return (
    <div className="grid min-w-0 gap-6">
      <FinanceOverview state={state} profile={profile} />
      <section className="grid min-w-0 gap-3" aria-labelledby="student-charges-heading">
        <FinanceHeading
          state={state}
          onTreat={() => setTreatmentIds([])}
          onManageContract={setContractId}
        />
        <FinanceTable state={state} onTreat={(row) => setTreatmentIds([row.installmentId])} />
      </section>
      {contractId && (
        <ContractRenegotiationDialog contractId={contractId} onClose={() => setContractId(null)} />
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
  onManageContract,
}: {
  state: StudentFinanceState;
  onTreat: () => void;
  onManageContract: (contractId: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <FinanceHeadingCopy filter={state.filter} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FinanceManagementActions
          state={state}
          onTreat={onTreat}
          onManageContract={onManageContract}
        />
        <div className="w-40">
          <Select
            value={state.filter}
            onValueChange={(value) => {
              if (value) state.setFilter(value);
            }}
          >
            <SelectTrigger size="sm" aria-label="Filtrar cobranças">
              <SelectValue>{financeFilterLabel(state)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overdue">
                Pendências{state.summary.data ? ` · ${state.summary.data.overdueCount}` : ""}
              </SelectItem>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function financeFilterLabel(state: StudentFinanceState): string {
  if (state.filter === "overdue")
    return `Pendências${state.summary.data ? ` · ${state.summary.data.overdueCount}` : ""}`;
  return state.filter === "paid" ? "Pagas" : "Todas";
}

function FinanceManagementActions({
  state,
  onTreat,
  onManageContract,
}: {
  state: StudentFinanceState;
  onTreat: () => void;
  onManageContract: (id: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const contracts = state.summary.data ? visibleFinanceContracts(state.summary.data) : [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
        <Ellipsis aria-hidden="true" /> Outras ações
      </PopoverTrigger>
      <PopoverContent align="end" size="menu" showArrow={false}>
        <div className={styles.management}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onTreat();
            }}
          >
            <Handshake aria-hidden="true" /> Negociar parcelas
          </Button>
          {contracts.map((contract) => (
            <Button
              key={contract.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                onManageContract(contract.id);
              }}
            >
              <FilePenLine aria-hidden="true" /> Renegociar / rescindir
              {contracts.length > 1 && contract.startsOn
                ? ` · ${formatDateOnlyBR(contract.startsOn)}`
                : ""}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FinanceHeadingCopy({ filter }: { filter: StudentFinanceState["filter"] }): ReactElement {
  let description = "Mensalidades, material e demais cobranças do aluno.";
  if (filter === "overdue") description = "Vencimentos mais antigos primeiro.";
  else if (filter === "paid") description = "Cobranças quitadas deste aluno.";
  return (
    <div>
      <h2 id="student-charges-heading" className="font-display text-xl font-semibold text-heading">
        {filter === "overdue" ? "Cobranças em atraso" : "Cobranças"}
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
      label={state.filter === "overdue" ? "Cobranças que precisam de ação" : "Cobranças do aluno"}
      columns={financeColumns({
        onReceive: state.setPayment,
        priorityId: state.filter === "overdue" ? state.data?.rows[0]?.installmentId : undefined,
        onTreat,
      })}
      state={financeTableState(state)}
      onRetry={() => void state.query.refetch()}
      errorTitle="Não foi possível carregar as cobranças"
      empty={{
        title: "Nenhuma cobrança vinculada",
        description: "As mensalidades, materiais e demais cobranças deste aluno aparecerão aqui.",
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
    itemLabel: { singular: "cobrança", plural: "cobranças" },
  };
  return state.data
    ? { ...common, pageCount: Math.max(1, state.data.pageCount), totalItems: state.data.total }
    : { ...common, loading: true };
}
