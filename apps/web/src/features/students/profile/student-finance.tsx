import { useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Handshake,
  FilePenLine,
  FileText,
  Ellipsis,
  CircleCheck,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
import { trpc } from "~/lib/trpc";
import {
  Button,
  DataTable,
  TableFilters,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type DataTableState,
  type TablePaginationConfig,
} from "@lazuli/ui";
import { FINANCE_INSTALLMENTS_PAGE_SIZE, type FinanceInstallmentRow } from "@lazuli/validators";
import { PaymentDialog } from "~/features/installments/payment/payment-dialog";
import { InstallmentProofDialog } from "~/features/installments/installment-proof-dialog";
import { INSTALLMENT_STATUSES, INSTALLMENT_STATUS_LABELS } from "~/features/installments/filters";
import { installmentColumnMode } from "~/features/installments/column-policy";
import { useStudentFinance, type StudentFinanceState } from "./finance-logic";
import { financeColumns, type FinanceRow } from "./finance-columns";
import { FinanceOverview } from "./finance-overview";
import { visibleFinanceContracts } from "./finance-contract-terms";
import { ContractRenegotiationDialog } from "./contract-renegotiation-dialog";
import { ContractTerminationNotice } from "./contract-termination-notice";
import { PaymentReversalDialog } from "./payment-reversal-dialog";
import { formatDateOnlyBR } from "~/lib/format";
import type { StudentProfile } from "./logic";
import styles from "./finance-overview.module.css";

const NewContractDialog = dynamic(() =>
  import("~/features/contracts/contracts-page").then((module) => module.NewContractDialog),
);

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
  const [proofRow, setProofRow] = useState<FinanceInstallmentRow | null>(null);
  const [creatingContract, setCreatingContract] = useState(false);
  const [reversingPayment, setReversingPayment] = useState(false);
  const noContract = state.summary.data?.contracts.length === 0;
  const hasHistory = Boolean(state.summary.data?.installmentCount);
  return (
    <div className={noContract ? "flex min-h-full min-w-0 flex-col" : "grid min-w-0 gap-6"}>
      {noContract && (
        <>
          {!hasHistory && (
            <ContractTerminationNotice termination={state.summary.data?.latestTermination} />
          )}
          <NoContractFinance hasHistory={hasHistory} onCreate={() => setCreatingContract(true)} />
        </>
      )}
      {(!noContract || hasHistory) && (
        <div className="grid min-w-0 gap-6">
          <FinanceOverview state={state} profile={profile} />
          <section className="grid min-w-0 gap-3" aria-labelledby="student-charges-heading">
            <FinanceHeading
              state={state}
              onTreat={() => setTreatmentIds([])}
              onManageContract={setContractId}
              onReversePayment={() => setReversingPayment(true)}
            />
            <FinanceTable
              state={state}
              onTreat={(row) => setTreatmentIds([row.installmentId])}
              onViewProof={setProofRow}
            />
          </section>
        </div>
      )}
      <StudentFinanceDialogs
        id={id}
        profile={profile}
        state={state}
        contractId={contractId}
        setContractId={setContractId}
        treatmentIds={treatmentIds}
        setTreatmentIds={setTreatmentIds}
        proofRow={proofRow}
        setProofRow={setProofRow}
        creatingContract={creatingContract}
        setCreatingContract={setCreatingContract}
        reversingPayment={reversingPayment}
        setReversingPayment={setReversingPayment}
      />
    </div>
  );
}

type FinanceDialogsProps = {
  id: string;
  profile: StudentProfile | undefined;
  state: StudentFinanceState;
  contractId: string | null;
  setContractId: (id: string | null) => void;
  treatmentIds: string[] | null;
  setTreatmentIds: (ids: string[] | null) => void;
  proofRow: FinanceInstallmentRow | null;
  setProofRow: (row: FinanceInstallmentRow | null) => void;
  creatingContract: boolean;
  setCreatingContract: (open: boolean) => void;
  reversingPayment: boolean;
  setReversingPayment: (open: boolean) => void;
};

function StudentFinanceDialogs(props: FinanceDialogsProps): ReactElement {
  const {
    id,
    profile,
    state,
    contractId,
    setContractId,
    treatmentIds,
    setTreatmentIds,
    proofRow,
    setProofRow,
    creatingContract,
    setCreatingContract,
    reversingPayment,
    setReversingPayment,
  } = props;
  const utils = trpc.useUtils();
  return (
    <>
      <NewContractDialog
        open={creatingContract}
        initialFields={{
          studentMode: "existing",
          studentId: id,
          studentName: profile?.contact.fullName ?? "",
        }}
        onOpenChange={setCreatingContract}
        onCreated={() => {
          setCreatingContract(false);
          void Promise.all([
            utils.finance.invalidate(),
            utils.students.invalidate(),
            utils.dashboard.invalidate(),
          ]);
        }}
      />
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
      {proofRow && (
        <InstallmentProofDialog
          installmentId={proofRow.installmentId}
          payerName={proofRow.payer.name}
          onClose={() => setProofRow(null)}
        />
      )}
      {reversingPayment && (
        <PaymentReversalDialog studentId={id} onClose={() => setReversingPayment(false)} />
      )}
    </>
  );
}

function NoContractFinance({
  hasHistory,
  onCreate,
}: {
  hasHistory: boolean;
  onCreate: () => void;
}): ReactElement {
  return (
    <section
      aria-labelledby="finance-empty-title"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <FileText aria-hidden="true" className="mb-2 size-12 text-icon" strokeWidth={1.5} />
      <h2 id="finance-empty-title" className="font-display text-2xl font-semibold text-heading">
        {hasHistory ? "Nenhum contrato em vigor" : "O financeiro começa com o contrato"}
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {hasHistory
          ? "Este aluno está sem contrato vigente. As cobranças e os pagamentos anteriores continuam disponíveis abaixo."
          : "Este aluno ainda não tem contrato. Ao criá-lo, as condições, cobranças e pagamentos aparecerão aqui."}
      </p>
      <Button onClick={onCreate}>
        Criar contrato <ArrowRight aria-hidden="true" />
      </Button>
    </section>
  );
}

function FinanceHeading({
  state,
  onTreat,
  onManageContract,
  onReversePayment,
}: {
  state: StudentFinanceState;
  onTreat: () => void;
  onManageContract: (contractId: string) => void;
  onReversePayment: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <FinanceHeadingCopy situations={state.situations} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FinanceManagementActions
          state={state}
          onTreat={onTreat}
          onManageContract={onManageContract}
          onReversePayment={onReversePayment}
        />
        <TableFilters
          fields={[
            {
              id: "situations",
              label: "Situação",
              kind: "options",
              icon: CircleCheck,
              promoted: true,
              options: INSTALLMENT_STATUSES.map((id) => ({
                id,
                label: INSTALLMENT_STATUS_LABELS[id],
              })),
              selected: state.situations,
              onChange: state.setSituations,
              onClear: () => state.setSituations([]),
            },
          ]}
          onClearAll={() => state.setSituations([])}
        />
      </div>
    </div>
  );
}

function FinanceManagementActions({
  state,
  onTreat,
  onManageContract,
  onReversePayment,
}: {
  state: StudentFinanceState;
  onTreat: () => void;
  onManageContract: (id: string) => void;
  onReversePayment: () => void;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  const contracts = state.summary.data ? visibleFinanceContracts(state.summary.data) : [];
  const showNegotiate = installmentColumnMode(state.situations) !== "paid";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
        <Ellipsis aria-hidden="true" /> Outras ações
      </PopoverTrigger>
      <PopoverContent align="end" size="menu" showArrow={false}>
        <div className={styles.management}>
          {showNegotiate && (
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
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onReversePayment();
            }}
          >
            <RotateCcw aria-hidden="true" /> Cancelar / estornar recebimento
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

function FinanceHeadingCopy({ situations }: Pick<StudentFinanceState, "situations">): ReactElement {
  const overdue = situations.length === 1 && situations[0] === "OVERDUE";
  const paid = situations.length === 1 && situations[0] === "PAID";
  let description = "Mensalidades, material e demais cobranças do aluno.";
  if (overdue) description = "Vencimentos mais antigos primeiro.";
  else if (paid) description = "Cobranças quitadas deste aluno.";
  return (
    <div>
      <h2 id="student-charges-heading" className="font-display text-xl font-semibold text-heading">
        {overdue ? "Cobranças em atraso" : "Cobranças"}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">{description}</p>
    </div>
  );
}

function FinanceTable({
  state,
  onTreat,
  onViewProof,
}: {
  state: StudentFinanceState;
  onTreat: (row: FinanceInstallmentRow) => void;
  onViewProof: (row: FinanceInstallmentRow) => void;
}): ReactElement {
  const overdue = state.situations.length === 1 && state.situations[0] === "OVERDUE";
  if (isEmptyOverdue(state, overdue))
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
          onClick={() => state.setSituations([])}
        >
          Ver todas as cobranças
        </Button>
      </div>
    );
  const columns = financeColumns({
    onReceive: state.setPayment,
    onViewProof,
    priorityId: overdue ? state.data?.rows[0]?.installmentId : undefined,
    onTreat,
    situations: state.situations,
  });
  return (
    <DataTable<FinanceRow>
      label={overdue ? "Cobranças que precisam de ação" : "Cobranças do aluno"}
      columns={columns}
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

function isEmptyOverdue(state: StudentFinanceState, overdue: boolean): boolean {
  return overdue && state.data?.total === 0 && !state.query.isError;
}
function financeTableState(state: StudentFinanceState): DataTableState<FinanceRow> {
  if (state.query.isError) return { kind: "error" };
  if (!state.data) return { kind: "loading" };
  const rows = state.data.rows.map((row) => ({ ...row, id: row.installmentId }));
  return rows.length > 0
    ? { kind: "data", rows }
    : { kind: state.situations.length === 0 ? "empty" : "noResults" };
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
