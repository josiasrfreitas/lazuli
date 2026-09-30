import { useState, type ReactElement } from "react";
import { Button, Field, Input, Label } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
import { usePaymentSearch, type PaymentFormState } from "./logic";
import { paymentDateLabel } from "./draft";
import { originLabel } from "../view-model";
export function PaymentPicker({ state }: { state: PaymentFormState }): ReactElement {
  const [open, setOpen] = useState(state.draft.items.length === 0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = usePaymentSearch({ search, page, enabled: open });
  const data = query.data;
  const rows = data && data.view !== "overdue" ? data.rows : [];
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="justify-self-start"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Fechar busca" : "Adicionar recebíveis"}
      </Button>
      {open && (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <Field>
            <Label>Buscar por pagador ou aluno</Label>
            <Input
              name="search"
              autoComplete="off"
              placeholder="Nome do pagador ou aluno"
              size="sm"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <SearchStatus query={query} />
          <SearchResults rows={rows} state={state} loading={query.isFetching} />
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
}: {
  rows: FinanceInstallmentRow[];
  state: PaymentFormState;
  loading: boolean;
}): ReactElement {
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto">
      {!loading && rows.length === 0 && (
        <p className="text-caption">Nenhum recebível encontrado.</p>
      )}
      {rows.map((row) => (
        <div
          className="flex items-center gap-3 border-b border-border py-2"
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
            <p className="break-all text-muted-foreground">Pedido {row.orderId}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={
              row.collectibleBalanceCents <= 0 ||
              state.draft.items.some((item) => item.row.installmentId === row.installmentId)
            }
            onClick={() => state.dispatch({ type: "add", row, receiptId: crypto.randomUUID() })}
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
