import { useId, useState, type ReactElement } from "react";
import { Plus, X } from "lucide-react";
import { SearchField } from "./payment-search-field";
import { Button } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
import { usePaymentSearch, type PaymentFormState } from "./logic";
import { paymentDateLabel } from "./draft";
import { originLabel } from "../view-model";
export function PaymentPicker({ state }: { state: PaymentFormState }): ReactElement {
  const [open, setOpen] = useState(state.draft.items.length === 0);
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = usePaymentSearch({ search, page, enabled: open });
  const data = query.data;
  const rows = data && data.view !== "overdue" ? data.rows : [];
  return (
    <div className="grid gap-2">
      <PickerHeader
        count={state.draft.items.length}
        open={open}
        searchId={searchId}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div id={searchId} className="grid gap-2 rounded-md border border-border bg-muted/20 p-3">
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <SearchStatus query={query} />
          <SearchResults
            rows={rows}
            state={state}
            loading={query.isFetching}
            onAdded={() => setOpen(false)}
          />
          <SearchPagination page={page} pages={data?.pageCount ?? 1} setPage={setPage} />
        </div>
      )}
    </div>
  );
}
function SearchResults({
  rows,
  state,
  loading,
  onAdded,
}: {
  rows: FinanceInstallmentRow[];
  state: PaymentFormState;
  loading: boolean;
  onAdded: () => void;
}): ReactElement {
  const availableRows = rows.filter((row) => isAvailable(row, state));
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto">
      {!loading && availableRows.length === 0 && (
        <p className="text-caption">Nenhum recebível encontrado.</p>
      )}
      {availableRows.map((row) => (
        <div
          className="flex items-center gap-3 border-b border-border py-2 last:border-0"
          key={row.installmentId}
        >
          <div className="min-w-0 flex-1 break-words text-caption">
            <p>
              {row.payer.name} · {row.beneficiaries.map((person) => person.fullName).join(", ")}
            </p>
            <p className="text-muted-foreground">
              {originLabel(row.origin)} · {row.sequenceNumber}/{row.scheduleTotal} ·{" "}
              {paymentDateLabel(row.dueDate)} · {money(row.collectibleBalanceCents)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              state.dispatch({ type: "add", row, receiptId: crypto.randomUUID() });
              onAdded();
            }}
          >
            Adicionar
          </Button>
        </div>
      ))}
    </div>
  );
}
function SearchPagination({
  page,
  pages,
  setPage,
}: {
  page: number;
  pages: number;
  setPage: (page: number) => void;
}): ReactElement {
  if (pages <= 1) return <></>;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-caption">Página {page}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}

function SearchStatus({ query }: { query: ReturnType<typeof usePaymentSearch> }): ReactElement {
  return (
    <>
      {query.isFetching && (
        <p role="status" className="text-caption">
          Buscando recebíveis…
        </p>
      )}
      {query.isError && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            void query.refetch();
          }}
        >
          Falha na busca. Tentar novamente
        </Button>
      )}
    </>
  );
}

function isAvailable(row: FinanceInstallmentRow, state: PaymentFormState): boolean {
  return (
    row.collectibleBalanceCents > 0 &&
    !state.draft.items.some((item) => item.row.installmentId === row.installmentId)
  );
}

function PickerHeader({
  count,
  open,
  searchId,
  onToggle,
}: {
  count: number;
  open: boolean;
  searchId: string;
  onToggle: () => void;
}): ReactElement {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-control font-semibold">Parcelas{count > 0 ? ` (${count})` : ""}</h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0"
          aria-controls={searchId}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {open ? "Fechar busca" : "Adicionar parcela"}
        </Button>
      </div>
      {count === 0 && (
        <p className="text-caption text-muted-foreground">
          Busque e adicione os recebíveis para registrar.
        </p>
      )}
    </>
  );
}
