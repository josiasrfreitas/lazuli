import { PaymentRowActions } from "./payment-row-actions";
import { useState, type ReactElement } from "react";
import { CurrencyInput, Field, FieldError, Label } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import { originLabel } from "../view-model";
import { paymentDateLabel, type DraftItem, type PreviewRow } from "./draft";
import type { PaymentFormState } from "./logic";
type RowProps = { item: DraftItem; preview: PreviewRow | undefined; state: PaymentFormState };
export function PaymentGrid({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <div
      className="divide-y divide-border rounded-md border border-border"
      aria-label="Parcelas do pagamento"
    >
      <div
        className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_9rem] gap-3 bg-muted px-3 py-2 text-caption font-semibold sm:grid"
        aria-hidden="true"
      >
        <span>Recebível</span>
        <span>Saldo registrado</span>
        <span>Na data</span>
        <span>Valor recebido</span>
      </div>
      {state.draft.items.map((item) => (
        <PaymentGridRow
          key={item.row.installmentId}
          item={item}
          preview={state.preview.find((row) => row.installmentId === item.row.installmentId)}
          state={state}
        />
      ))}
      {state.draft.items.length === 0 && (
        <p className="p-4 text-caption text-muted-foreground">
          Busque e adicione os recebíveis para registrar.
        </p>
      )}
    </div>
  );
}
function PaymentGridRow(props: RowProps): ReactElement {
  const [details, setDetails] = useState(false);
  const { item } = props;
  return (
    <div className="grid gap-2 px-3 py-2">
      <div className="grid min-w-0 grid-cols-2 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_9rem]">
        <RowIdentity item={item} state={props.state} />
        <RowAmounts preview={props.preview} />
        <div className="col-span-2 sm:col-span-1">
          <ReceivedField {...props} />
          <PaymentRowActions
            item={item}
            state={props.state}
            details={details}
            setDetails={setDetails}
          />
        </div>
      </div>
      {details && (
        <p className="break-all text-caption text-muted-foreground">
          Referência do pedido: {item.row.orderId}. Recebido anteriormente:{" "}
          {money(item.row.paidAmountCents)}. O saldo resultante considera somente os encargos novos
          e o desconto efetivamente elegível.
        </p>
      )}
    </div>
  );
}
function RowIdentity({ item, state }: Pick<RowProps, "item" | "state">): ReactElement {
  const receiptIds = [...new Set(state.draft.items.map((row) => row.receiptId))];
  const receiptNumber = receiptIds.indexOf(item.receiptId) + 1;
  return (
    <div className="col-span-2 min-w-0 break-words sm:col-span-1">
      <p className="text-control font-medium">
        {item.row.beneficiaries.map((person) => person.fullName).join(", ") || item.row.payer.name}
      </p>
      <p className="text-caption text-muted-foreground">
        {item.row.payer.name} · {originLabel(item.row.origin)} · {item.row.sequenceNumber}/
        {item.row.scheduleTotal}
      </p>
      <p className="text-caption text-muted-foreground">
        Vence {paymentDateLabel(item.row.dueDate)} · Recebimento {receiptNumber}
      </p>
    </div>
  );
}
function RowAmounts({ preview }: Pick<RowProps, "preview">): ReactElement {
  const quote = preview?.line?.quote;
  return (
    <>
      <div className="text-caption">
        <span className="block text-muted-foreground sm:hidden">Saldo registrado</span>
        <span className="font-numeric">{quote ? money(quote.balanceCents) : "—"}</span>
      </div>
      <div className="text-caption">
        <span className="block text-muted-foreground sm:hidden">Na data</span>
        <p className="font-numeric">Juros: {quote ? money(quote.newInterestCents) : "—"}</p>
        <p className="font-numeric">Desc.: {quote ? money(quote.discountCents) : "—"}</p>
      </div>
    </>
  );
}
function ReceivedField({ item, preview, state }: RowProps): ReactElement {
  const { amount, invalid } = receivedFieldState(item, preview);
  const error =
    preview?.error ??
    (state.error?.includes(item.row.installmentId)
      ? "Revise esta parcela e atualize a prévia."
      : null);
  return (
    <Field className="col-span-2 sm:col-span-1">
      <Label className="sm:sr-only">Valor recebido</Label>
      <CurrencyInput
        name={`received-${item.row.installmentId}`}
        autoComplete="off"
        placeholder="R$ 0,00"
        size="sm"
        value={amount}
        invalid={invalid || Boolean(error)}
        onValueChange={(value) =>
          state.dispatch({ type: "amount", id: item.row.installmentId, value })
        }
      />
      <span className="text-caption text-muted-foreground">
        {rowEffect(state.loading, preview)}
      </span>
      {(error || invalid) && (
        <FieldError match>{error ?? "Informe um valor positivo até a quitação."}</FieldError>
      )}
    </Field>
  );
}
function rowEffect(loading: boolean, preview: PreviewRow | undefined): string {
  if (loading) return "Calculando…";
  const quote = preview?.line?.quote;
  if (!quote) return "Prévia indisponível";
  if (quote.remainingCents > 0) return `Parcial · resta ${money(quote.remainingCents)}`;
  return "Quitação integral";
}
function receivedFieldState(
  item: DraftItem,
  preview: PreviewRow | undefined,
): { amount: number | null; invalid: boolean } {
  const quote = preview?.line?.quote;
  const amount = item.amount === undefined ? (quote?.receivedCents ?? null) : item.amount;
  const invalid =
    amount !== null && (amount <= 0 || (quote !== undefined && amount > quote.settlementCents));
  return { amount, invalid };
}
