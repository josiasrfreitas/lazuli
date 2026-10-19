import { ReceiptText } from "lucide-react";
import { FormSection } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import { draftReceipts, paymentDraftError } from "./draft";
import type { PaymentFormState } from "./logic";

export function PaymentSummary({ state }: { state: PaymentFormState }) {
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
          Adicione parcelas para conferir os valores do recebimento.
        </p>
      ) : (
        <>
          <dl className="grid gap-2 text-caption" aria-live="polite">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Parcelas selecionadas</dt>
              <dd className="font-numeric font-medium">{state.draft.items.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Recebimentos</dt>
              <dd className="font-numeric font-medium">{receipts.length}</dd>
            </div>
            {ready && interest > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Novos juros</dt>
                <dd className="shrink-0 font-numeric">{money(interest)}</dd>
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
                {state.loading ? "Calculando…" : ready ? money(remaining) : "Prévia indisponível"}
              </dd>
            </div>
          </dl>
          <p className="text-caption text-muted-foreground">
            As parcelas estão agrupadas por recebimento. Data e forma de pagamento se aplicam a todo
            o lote.
          </p>
        </>
      )}
    </FormSection>
  );
}
