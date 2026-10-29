import type { JSX as ReactJSX } from "react";
import { ReceiptText } from "lucide-react";
import { FormSection } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import { draftReceipts, paymentDraftError } from "./draft";
import type { PaymentFormState } from "./logic";
import { PaymentInterest } from "./payment-interest";

export function PaymentSummary({ state }: { state: PaymentFormState }): ReactJSX.Element {
  const totals = paymentTotals(state);
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <ReceiptText className="size-4" aria-hidden /> Resumo do pagamento
        </span>
      }
    >
      {state.draft.items.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          Adicione cobranças para conferir os valores do recebimento.
        </p>
      ) : (
        <PaymentSummaryDetails state={state} totals={totals} />
      )}
    </FormSection>
  );
}

function paymentTotals(state: PaymentFormState): {
  receiptCount: number;
  ready: boolean;
  interest: number;
  discount: number;
  remaining: number;
} {
  const receipts = draftReceipts(state.draft, state.preview);
  const ready =
    !state.loading &&
    state.preview.length === state.draft.items.length &&
    state.preview.every((row) => row.line) &&
    paymentDraftError(state.draft, state.preview) === null;
  const interest = state.preview.reduce(
    (sum, row) => sum + (row.line?.quote.newInterestCents ?? 0),
    0,
  );
  const discount = state.preview.reduce(
    (sum, row) => sum + (row.line?.quote.discountCents ?? 0),
    0,
  );
  const remaining = state.preview.reduce(
    (sum, row) => sum + (row.line?.quote.remainingCents ?? 0),
    0,
  );
  return { receiptCount: receipts.length, ready, interest, discount, remaining };
}

function PaymentSummaryDetails({
  state,
  totals,
}: {
  state: PaymentFormState;
  totals: ReturnType<typeof paymentTotals>;
}): ReactJSX.Element {
  const { receiptCount, ready, interest, discount, remaining } = totals;
  return (
    <>
      <dl className="grid gap-2 text-caption" aria-live="polite">
        {state.draft.items.length > 1 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cobranças selecionadas</dt>
            <dd className="font-numeric font-medium">{state.draft.items.length}</dd>
          </div>
        )}
        {receiptCount > 1 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Recebimentos</dt>
            <dd className="font-numeric font-medium">{receiptCount}</dd>
          </div>
        )}
        {ready && interest > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Novos juros</dt>
            <dd className="shrink-0 font-numeric">{money(interest)}</dd>
            <dd className="col-span-full text-muted-foreground">
              <PaymentInterest state={state} />
            </dd>
          </div>
        )}
        {ready && discount > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Desconto por pontualidade</dt>
            <dd className="shrink-0 font-numeric text-success">{money(discount)}</dd>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
          <dt className="text-muted-foreground">Saldo após pagamento</dt>
          <dd className="font-numeric font-semibold">
            {balanceLabel({ loading: state.loading, ready, remaining })}
          </dd>
        </div>
      </dl>
      {state.draft.items.length > 1 && (
        <p className="text-caption text-muted-foreground">
          As cobranças estão agrupadas por recebimento. Data e forma de pagamento se aplicam a todo
          o lote.
        </p>
      )}
    </>
  );
}

function balanceLabel({
  loading,
  ready,
  remaining,
}: {
  loading: boolean;
  ready: boolean;
  remaining: number;
}): string {
  if (loading) return "Calculando…";
  if (ready) return money(remaining);
  return "Prévia indisponível";
}
