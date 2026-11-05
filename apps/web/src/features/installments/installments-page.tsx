"use client";

import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Handshake, X } from "lucide-react";
import { Button, DataTablePage, FloatingToolbar, TablePagination } from "@lazuli/ui";
import {
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
  type FinanceInstallmentRow,
} from "@lazuli/validators";
import { tablePaginationPropsFor } from "~/lib/pagination";
import { hasInstallmentFilters, type InstallmentFilters } from "./filters";
import { InstallmentActionsContext } from "./installment-actions";
import { InstallmentsTable } from "./installments-table";
import { InstallmentProofDialog } from "./installment-proof-dialog";
import { installmentColumnMode } from "./column-policy";
import { useInstallments, type InitialInstallmentsData } from "./logic";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
import { PaymentDialog } from "./payment/payment-dialog";
import {
  PaymentSelectionContext,
  toggleSelected,
  toggleVisibleSelection,
} from "./payment/selection";
import { InstallmentsControls } from "./installments-controls";

const MAX_NEGOTIATION_INSTALLMENTS = 100;

type EntrySession = {
  session: FinanceInstallmentRow[] | null;
  open: boolean;
  registered: boolean;
  begin: (rows: FinanceInstallmentRow[]) => void;
  setOpen: (open: boolean) => void;
  complete: () => void;
};

function useEntrySession(clear: () => void): EntrySession {
  const [session, setSession] = useState<FinanceInstallmentRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  return {
    session,
    open,
    registered,
    setOpen,
    begin: (rows) => {
      setSession((current) => {
        if (!current) return rows;
        if (rows.length === 0) return current;
        const ids = new Set(current.map((row) => row.installmentId));
        return [...current, ...rows.filter((row) => !ids.has(row.installmentId))];
      });
      setOpen(true);
      setRegistered(false);
    },
    complete: () => {
      setSession(null);
      setOpen(false);
      clear();
      setRegistered(true);
    },
  };
}

function SelectionToolbar({
  count,
  outside,
  clear,
  begin,
  negotiate,
}: {
  count: number;
  outside: number;
  clear: () => void;
  begin: () => void;
  negotiate: () => void;
}): ReactElement {
  return (
    <FloatingToolbar aria-label="Recebíveis selecionados">
      <Button size="icon-sm" variant="ghost" aria-label="Limpar seleção" onClick={clear}>
        <X aria-hidden="true" />
      </Button>
      <span role="status" className="text-caption">
        {count} selecionados{outside > 0 ? ` · ${outside} fora da vista` : ""}
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={negotiate}
        disabled={count > MAX_NEGOTIATION_INSTALLMENTS}
      >
        <Handshake aria-hidden="true" />
        Negociar
      </Button>
      {count > MAX_NEGOTIATION_INSTALLMENTS && (
        <span className="text-caption">Negocie até 100 parcelas por lote.</span>
      )}
      <Button size="sm" onClick={begin}>
        <DollarSign aria-hidden="true" />
        Registrar pagamento
      </Button>
    </FloatingToolbar>
  );
}

export function InstallmentsPagination({
  data,
  filters,
  setPage,
  setPageSize,
}: Pick<ReturnType<typeof useInstallments>, "data" | "setPage" | "setPageSize"> & {
  filters: Pick<InstallmentFilters, "status" | "page" | "pageSize"> &
    Partial<Pick<InstallmentFilters, "situations">>;
}): ReactElement {
  const grouped = filters.status === "vencidas" || (filters.situations?.length ?? 0) > 0;
  return (
    <TablePagination
      className={grouped ? "bg-transparent" : undefined}
      itemLabel={
        grouped
          ? { singular: "pagador", plural: "pagadores" }
          : { singular: "parcela", plural: "parcelas" }
      }
      {...tablePaginationPropsFor(
        {
          page: filters.page,
          pageSize: grouped ? financeOverduePaginationPolicy.defaultPageSize : filters.pageSize,
          ...(grouped
            ? {}
            : { pageSizeOptions: financeInstallmentsPaginationPolicy.pageSizeOptions }),
          setPage,
          setPageSize,
        },
        data,
      )}
    />
  );
}

type InstallmentsPageState = ReturnType<typeof useInstallments>;

function InstallmentsTableFooter({
  state,
  toolbar,
}: {
  state: InstallmentsPageState;
  toolbar: ReactElement | null;
}): ReactElement {
  return (
    <div className="relative">
      <p role="status" className="sr-only">
        {state.query.isFetching ? "Atualizando recebíveis" : ""}
      </p>
      <InstallmentsPagination
        data={state.data}
        filters={state.filters}
        setPage={state.setPage}
        setPageSize={state.setPageSize}
      />
      {toolbar}
    </div>
  );
}

function InstallmentsTableContent({
  state,
  toolbar,
  onRowClick,
}: {
  state: InstallmentsPageState;
  toolbar: ReactElement | null;
  onRowClick: (row: FinanceInstallmentRow) => void;
}): ReactElement {
  const { data, filters, query } = state;
  const situations = filters.status === "vencidas" ? (["OVERDUE"] as const) : filters.situations;
  return (
    <InstallmentsTable
      rows={data?.view === "all" || data?.view === "paid" ? data.rows : undefined}
      groups={data?.view === "overdue" || data?.view === "grouped" ? data.groups : undefined}
      situations={situations}
      onRowClick={onRowClick}
      error={query.isError}
      filtered={hasInstallmentFilters(filters)}
      showGroupedSearchGuidance={filters.situations.length > 0 && filters.search.trim() !== ""}
      showOverdueSearchGuidance={filters.status === "vencidas" && filters.search.trim() !== ""}
      updating={query.isFetching}
      footer={<InstallmentsTableFooter state={state} toolbar={toolbar} />}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}

function InstallmentsTableFrame({
  state,
  beginPayment,
  toolbar,
}: {
  state: InstallmentsPageState;
  beginPayment: (rows: FinanceInstallmentRow[]) => void;
  toolbar: ReactElement | null;
}): ReactElement {
  const router = useRouter();
  const openStudentFinance = (row: FinanceInstallmentRow): void => {
    const studentId = row.beneficiaries[0]?.studentId;
    if (studentId) router.push(`/alunos/${studentId}?secao=financeiro`);
  };
  return (
    <DataTablePage
      title="Recebíveis"
      controls={
        <div className="flex flex-wrap items-center gap-2">
          <InstallmentsControls
            search={state.filters.search}
            filters={state.filters}
            onSearch={state.setSearch}
            onFilters={state.setFilters}
          />
          {installmentColumnMode(
            state.filters.status === "vencidas" ? ["OVERDUE"] : state.filters.situations,
          ) !== "paid" && (
            <Button size="sm" onClick={() => beginPayment([])}>
              <DollarSign aria-hidden="true" />
              Registrar pagamento
            </Button>
          )}
        </div>
      }
    >
      <InstallmentsTableContent state={state} toolbar={toolbar} onRowClick={openStudentFinance} />
    </DataTablePage>
  );
}

function PaymentRegisteredStatus({ registered }: { registered: boolean }): ReactElement | null {
  return registered ? (
    <p role="status" className="px-6 pt-2 text-caption text-success">
      Pagamento registrado.
    </p>
  ) : null;
}

function PaymentEntryDialog({ entry }: { entry: EntrySession }): ReactElement | null {
  return entry.session === null ? null : (
    <PaymentDialog
      rows={entry.session}
      open={entry.open}
      onOpenChange={entry.setOpen}
      onRegistered={entry.complete}
    />
  );
}

export function InstallmentsPage({
  initial,
}: {
  initial?: InitialInstallmentsData | undefined;
}): ReactElement {
  const state = useInstallments(initial);
  const [rows, setRows] = useState<FinanceInstallmentRow[]>([]);
  const [paymentRow, setPaymentRow] = useState<FinanceInstallmentRow | null>(null);
  const [proofRow, setProofRow] = useState<FinanceInstallmentRow | null>(null);
  const [rowPaymentRegistered, setRowPaymentRegistered] = useState(false);
  const [treatmentIds, setTreatmentIds] = useState<string[] | null>(null);
  const [treatmentRegistered, setTreatmentRegistered] = useState(false);
  useEffect(() => setRows([]), [state.filters.studentId]);
  const entry = useEntrySession(() => setRows([]));
  const mode = installmentColumnMode(
    state.filters.status === "vencidas" ? ["OVERDUE"] : state.filters.situations,
  );
  useEffect(() => {
    if (mode === "paid" || mode === "waived") setRows([]);
  }, [mode]);
  const visible =
    state.data?.view === "overdue" || state.data?.view === "grouped"
      ? state.data.groups.flatMap((group) => group.rows)
      : (state.data?.rows ?? []);
  const toolbar =
    mode === "paid" || mode === "waived"
      ? null
      : selectionToolbar({
          rows,
          visible,
          entry,
          paymentRow,
          treatmentIds,
          setRows,
          setTreatmentIds,
          setTreatmentRegistered,
        });
  return (
    <InstallmentsPageView
      {...{
        state,
        rows,
        visible,
        toolbar,
        entry,
        paymentRow,
        proofRow,
        setProofRow,
        setPaymentRow,
        setRows,
        rowPaymentRegistered,
        setRowPaymentRegistered,
        treatmentIds,
        setTreatmentIds,
        treatmentRegistered,
        setTreatmentRegistered,
      }}
    />
  );
}

type InstallmentsPageViewProps = InstallmentDialogsProps & {
  state: InstallmentsPageState;
  rows: FinanceInstallmentRow[];
  visible: FinanceInstallmentRow[];
  toolbar: ReactElement | null;
  entry: EntrySession;
  rowPaymentRegistered: boolean;
  proofRow: FinanceInstallmentRow | null;
  setProofRow: Dispatch<SetStateAction<FinanceInstallmentRow | null>>;
};

function InstallmentsPageView(props: InstallmentsPageViewProps): ReactElement {
  const {
    state,
    rows,
    visible,
    toolbar,
    entry,
    setRows,
    setPaymentRow,
    proofRow,
    setProofRow,
    setRowPaymentRegistered,
    setTreatmentIds,
    setTreatmentRegistered,
    rowPaymentRegistered,
  } = props;
  return (
    <InstallmentActionsContext.Provider
      value={{
        receive: (row) => {
          setRowPaymentRegistered(false);
          setPaymentRow(row);
        },
        negotiate: (row) => {
          setTreatmentRegistered(false);
          setTreatmentIds([row.installmentId]);
        },
        viewProof: (row) => setProofRow(row),
      }}
    >
      <PaymentSelectionContext.Provider
        value={{
          rows,
          visible,
          toggle: (row) => setRows((current) => toggleSelected(current, row)),
          toggleVisible: () => setRows((current) => toggleVisibleSelection(current, visible)),
        }}
      >
        <PaymentRegisteredStatus registered={entry.registered || rowPaymentRegistered} />
        <InstallmentsTableFrame state={state} beginPayment={entry.begin} toolbar={toolbar} />
        <PaymentEntryDialog entry={entry} />
        <InstallmentDialogs {...props} />
        {proofRow && (
          <InstallmentProofDialog
            installmentId={proofRow.installmentId}
            payerName={proofRow.payer.name}
            onClose={() => setProofRow(null)}
          />
        )}
      </PaymentSelectionContext.Provider>
    </InstallmentActionsContext.Provider>
  );
}

function selectionToolbar({
  rows,
  visible,
  entry,
  paymentRow,
  treatmentIds,
  setRows,
  setTreatmentIds,
  setTreatmentRegistered,
}: {
  rows: FinanceInstallmentRow[];
  visible: FinanceInstallmentRow[];
  entry: EntrySession;
  paymentRow: FinanceInstallmentRow | null;
  treatmentIds: string[] | null;
  setRows: Dispatch<SetStateAction<FinanceInstallmentRow[]>>;
  setTreatmentIds: Dispatch<SetStateAction<string[] | null>>;
  setTreatmentRegistered: Dispatch<SetStateAction<boolean>>;
}): ReactElement | null {
  if (rows.length === 0 || entry.open || paymentRow || treatmentIds) return null;
  const outside = rows.filter(
    (row) => !visible.some((item) => item.installmentId === row.installmentId),
  ).length;
  return (
    <SelectionToolbar
      count={rows.length}
      outside={outside}
      clear={() => setRows([])}
      begin={() => entry.begin(rows)}
      negotiate={() => {
        setTreatmentRegistered(false);
        setTreatmentIds(rows.map((row) => row.installmentId));
      }}
    />
  );
}

type InstallmentDialogsProps = {
  paymentRow: FinanceInstallmentRow | null;
  setPaymentRow: Dispatch<SetStateAction<FinanceInstallmentRow | null>>;
  setRows: Dispatch<SetStateAction<FinanceInstallmentRow[]>>;
  setRowPaymentRegistered: Dispatch<SetStateAction<boolean>>;
  treatmentIds: string[] | null;
  setTreatmentIds: Dispatch<SetStateAction<string[] | null>>;
  treatmentRegistered: boolean;
  setTreatmentRegistered: Dispatch<SetStateAction<boolean>>;
};

function InstallmentDialogs(props: InstallmentDialogsProps): ReactElement {
  const { paymentRow, treatmentIds, treatmentRegistered } = props;
  return (
    <>
      {paymentRow && <InstallmentRowPaymentDialog {...props} paymentRow={paymentRow} />}
      {treatmentRegistered && (
        <p role="status" className="px-6 pt-2 text-caption text-success">
          Tratativa registrada.
        </p>
      )}
      {treatmentIds && <InstallmentTreatmentDialog {...props} treatmentIds={treatmentIds} />}
    </>
  );
}

function InstallmentRowPaymentDialog({
  paymentRow,
  setPaymentRow,
  setRows,
  setRowPaymentRegistered,
}: InstallmentDialogsProps & { paymentRow: FinanceInstallmentRow }): ReactElement {
  return (
    <PaymentDialog
      key={paymentRow.installmentId}
      rows={[paymentRow]}
      open
      onOpenChange={(open) => {
        if (!open) setPaymentRow(null);
      }}
      onRegistered={() => {
        setRows((current) =>
          current.filter((row) => row.installmentId !== paymentRow.installmentId),
        );
        setPaymentRow(null);
        setRowPaymentRegistered(true);
      }}
    />
  );
}

function InstallmentTreatmentDialog({
  treatmentIds,
  setTreatmentIds,
  setRows,
  setTreatmentRegistered,
}: InstallmentDialogsProps & { treatmentIds: string[] }): ReactElement {
  return (
    <TreatmentDialog
      initialIds={treatmentIds}
      onClose={() => setTreatmentIds(null)}
      onConfirmed={() => {
        setRows((current) => current.filter((row) => !treatmentIds.includes(row.installmentId)));
        setTreatmentRegistered(true);
      }}
    />
  );
}
