"use client";

import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { CircleCheck, DollarSign, Handshake, Search, Tags, X } from "lucide-react";
import {
  Button,
  DataTablePage,
  FloatingToolbar,
  Input,
  TableFilters,
  TablePagination,
  type TableFilterField,
} from "@lazuli/ui";
import {
  financeInstallmentsPaginationPolicy,
  financeOverduePaginationPolicy,
  orderKindSchema,
  type FinanceInstallmentRow,
} from "@lazuli/validators";
import { useSearchDraft } from "~/lib/use-search-draft";
import { trpc } from "~/lib/trpc";
import { tablePaginationPropsFor } from "~/lib/pagination";
import {
  INSTALLMENT_STATUSES,
  SEARCH_MAX_LENGTH,
  situationPatch,
  type InstallmentFilters,
  type InstallmentFilterPatch,
} from "./filters";
import { InstallmentActionsContext } from "./installment-actions";
import { InstallmentsTable } from "./installments-table";
import { useInstallments } from "./logic";
import { TreatmentDialog } from "~/features/financial-treatments/treatment-dialog";
import { PaymentDialog } from "./payment/payment-dialog";
import {
  PaymentSelectionContext,
  toggleSelected,
  toggleVisibleSelection,
} from "./payment/selection";
import { originLabel } from "./view-model";

const MAX_NEGOTIATION_INSTALLMENTS = 100;

function hasInstallmentFilters(filters: InstallmentFilters): boolean {
  return Boolean(
    filters.studentId ||
    filters.search ||
    filters.status ||
    filters.situations.length > 0 ||
    filters.origins.length > 0 ||
    filters.dueFrom ||
    filters.dueTo ||
    filters.amountFrom ||
    filters.amountTo,
  );
}

function SearchField({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}): ReactElement {
  const [value, setValue] = useSearchDraft(search, onSearch);
  return (
    <div className="relative w-full sm:w-44 lg:w-64 2xl:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
      />
      <Input
        aria-label="Buscar por pagador ou beneficiário"
        className="pl-8"
        type="search"
        placeholder="Buscar por pagador ou beneficiário"
        maxLength={SEARCH_MAX_LENGTH}
        size="sm"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
    </div>
  );
}

function situationField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "situations",
    label: "Situação",
    kind: "options",
    icon: CircleCheck,
    promoted: true,
    options: INSTALLMENT_STATUSES.map((id) => ({
      id,
      label: {
        OVERDUE: "Vencida",
        DUE_THIS_MONTH: "Vence este mês",
        UPCOMING: "A vencer",
        PAID: "Paga",
        WAIVED: "Dispensada",
      }[id],
    })),
    selected: input.filters.status === "vencidas" ? ["OVERDUE"] : input.filters.situations,
    onChange: (values) => input.onFilters(situationPatch(values)),
    onClear: () => input.onFilters(situationPatch([])),
  };
}

function dueField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "due",
    label: "Vencimento",
    kind: "period",
    promoted: true,
    from: input.filters.dueFrom,
    to: input.filters.dueTo,
    onChange: (from, to) => {
      if (from && to && from > to) {
        if (from === input.filters.dueFrom) from = "";
        else to = "";
      }
      input.onFilters({ dueFrom: from || null, dueTo: to || null });
    },
    onClear: () => input.onFilters({ dueFrom: null, dueTo: null }),
  };
}

function originField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "origins",
    label: "Origem",
    kind: "options",
    icon: Tags,
    promoted: true,
    options: orderKindSchema.options.map((id) => ({ id, label: originLabel(id) })),
    selected: input.filters.origins,
    onChange: (values) => input.onFilters({ origins: values.join(",") || null }),
    onClear: () => input.onFilters({ origins: null }),
  };
}

function amountField(input: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): TableFilterField {
  return {
    id: "amount",
    label: "Valor (R$)",
    kind: "amount",
    from: input.filters.amountFrom,
    to: input.filters.amountTo,
    onChange: (from, to) => {
      if (from && to && Number(from) > Number(to)) {
        if (from === input.filters.amountFrom) from = "";
        else to = "";
      }
      input.onFilters({ amountFrom: from || null, amountTo: to || null });
    },
    onClear: () => input.onFilters({ amountFrom: null, amountTo: null }),
  };
}

function InstallmentsControls({
  search,
  filters,
  onSearch,
  onFilters,
}: {
  search: string;
  filters: InstallmentFilters;
  onSearch: (value: string) => void;
  onFilters: (patch: InstallmentFilterPatch) => void;
}): ReactElement {
  const student = trpc.students.byId.useQuery(
    { id: filters.studentId ?? "" },
    { enabled: Boolean(filters.studentId) },
  );
  const filterFields = [
    ...studentFilterFields({ filters, onFilters, studentName: student.data?.contact.fullName }),
    situationField({ filters, onFilters }),
    originField({ filters, onFilters }),
    dueField({ filters, onFilters }),
    amountField({ filters, onFilters }),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 2xl:gap-3">
      <SearchField search={search} onSearch={onSearch} />
      <TableFilters
        fields={filterFields}
        onClearAll={() =>
          onFilters({
            studentId: null,
            status: null,
            situations: null,
            origins: null,
            dueFrom: null,
            dueTo: null,
            amountFrom: null,
            amountTo: null,
          })
        }
      />
    </div>
  );
}

function studentFilterFields({
  filters,
  onFilters,
  studentName,
}: {
  filters: InstallmentFilters;
  onFilters: (patch: InstallmentFilterPatch) => void;
  studentName: string | undefined;
}): TableFilterField[] {
  if (!filters.studentId) return [];
  return [
    {
      id: "student",
      label: "Aluno",
      kind: "options",
      promoted: true,
      options: [{ id: filters.studentId, label: studentName ?? "Aluno selecionado" }],
      selected: [filters.studentId],
      onChange: (values) => onFilters({ studentId: values[0] ?? null }),
      onClear: () => onFilters({ studentId: null }),
    },
  ];
}

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
  filters: Pick<InstallmentFilters, "status" | "page" | "pageSize">;
}): ReactElement {
  const overdue = filters.status === "vencidas";
  return (
    <TablePagination
      className={overdue ? "bg-transparent" : undefined}
      itemLabel={
        overdue
          ? { singular: "pagador", plural: "pagadores" }
          : { singular: "parcela", plural: "parcelas" }
      }
      {...tablePaginationPropsFor(
        {
          page: filters.page,
          pageSize: overdue ? financeOverduePaginationPolicy.defaultPageSize : filters.pageSize,
          ...(overdue
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
}: {
  state: InstallmentsPageState;
  toolbar: ReactElement | null;
}): ReactElement {
  const { data, filters, query } = state;
  return (
    <InstallmentsTable
      rows={data?.view === "all" || data?.view === "paid" ? data.rows : undefined}
      groups={data?.view === "overdue" ? data.groups : undefined}
      error={query.isError}
      filtered={hasInstallmentFilters(filters)}
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
          <Button size="sm" onClick={() => beginPayment([])}>
            <DollarSign aria-hidden="true" />
            Registrar pagamento
          </Button>
        </div>
      }
    >
      <InstallmentsTableContent state={state} toolbar={toolbar} />
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

export function InstallmentsPage(): ReactElement {
  const state = useInstallments();
  const [rows, setRows] = useState<FinanceInstallmentRow[]>([]);
  const [paymentRow, setPaymentRow] = useState<FinanceInstallmentRow | null>(null);
  const [rowPaymentRegistered, setRowPaymentRegistered] = useState(false);
  const [treatmentIds, setTreatmentIds] = useState<string[] | null>(null);
  const [treatmentRegistered, setTreatmentRegistered] = useState(false);
  useEffect(() => setRows([]), [state.filters.studentId]);
  const entry = useEntrySession(() => setRows([]));
  const visible =
    state.data?.view === "overdue"
      ? state.data.groups.flatMap((group) => group.rows)
      : (state.data?.rows ?? []);
  const toolbar = selectionToolbar({
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
