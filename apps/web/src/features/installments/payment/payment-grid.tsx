import { PaymentAllocation, PaymentReceiptGroup } from "./payment-receipts";
import { PaymentRowActions } from "./payment-row-actions";
import { useState, type ReactElement } from "react";
import { CurrencyInput, Field, FieldDescription, FieldError, Label } from "@lazuli/ui";
import { formatBRLFromCents as money } from "~/lib/format";
import { originLabel } from "../view-model";
import { draftReceipts, paymentDateLabel, type DraftItem, type PreviewRow } from "./draft";
import type { PaymentFormState } from "./logic";
type RowProps = { item: DraftItem; preview: PreviewRow | undefined; state: PaymentFormState };
export function PaymentGrid({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <div className="grid gap-3" aria-label="Parcelas do pagamento">
      {draftReceipts(state.draft, state.preview).map((receipt) => {
        const items = state.draft.items.filter((item) => item.receiptId === receipt.commandId);
        return (
          <PaymentReceiptGroup key={receipt.commandId} items={items} total={receipt.amountCents}>
            {items.map((item) => (
              <PaymentGridRow
                key={item.row.installmentId}
                item={item}
                preview={state.preview.find((row) => row.installmentId === item.row.installmentId)}
                state={state}
              />
            ))}
          </PaymentReceiptGroup>
        );
      })}
    </div>
  );
}
function PaymentGridRow(props: RowProps): ReactElement {
  const [details, setDetails] = useState(false);
  const { item } = props;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-x-2 gap-y-3 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_2rem]">
      <div className="min-w-0">
        <RowIdentity item={item} />
        <RowAmounts preview={props.preview} />
      </div>
      <ReceivedField {...props} />
      <div className="col-start-2 row-start-1 sm:col-start-3">
        <PaymentRowActions
          item={item}
          state={props.state}
          details={details}
          setDetails={setDetails}
        />
      </div>
      {details && (
        <div className="col-span-full">
          <PaymentAllocation item={item} state={props.state} />
        </div>
      )}
    </div>
  );
}
function RowIdentity({ item }: Pick<RowProps, "item">): ReactElement {
  return (
    <div className="min-w-0 break-words">
      <p className="text-control font-medium">
        {item.row.beneficiaries.map((person) => person.fullName).join(", ") || item.row.payer.name}
      </p>
      <p className="mt-1 text-caption text-muted-foreground">
        {originLabel(item.row.origin)} {item.row.sequenceNumber}/{item.row.scheduleTotal}
        {" · vence "}
        {paymentDateLabel(item.row.dueDate)}
      </p>
    </div>
  );
}
function RowAmounts({ preview }: Pick<RowProps, "preview">): ReactElement {
  const quote = preview?.line?.quote;
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption">
      <p className="text-muted-foreground">
        Saldo{" "}
        <span className="whitespace-nowrap font-numeric text-foreground">
          {quote ? money(quote.balanceCents) : "—"}
        </span>
      </p>
      <RowAdjustments preview={preview} />
    </div>
  );
}

function RowAdjustments({ preview }: Pick<RowProps, "preview">): ReactElement | null {
  const quote = preview?.line?.quote;
  if (!quote) return null;
  return (
    <>
      {quote.newInterestCents > 0 && (
        <p className="whitespace-nowrap font-numeric text-muted-foreground">
          + {money(quote.newInterestCents)} juros
        </p>
      )}
      {quote.discountCents > 0 && (
        <p className="whitespace-nowrap font-numeric text-success">
          − {money(quote.discountCents)} desconto por pontualidade
        </p>
      )}
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
    <Field className="col-span-2 row-start-2 max-w-64 sm:col-span-1 sm:col-start-2 sm:row-start-1">
      <Label>Valor recebido</Label>
      <CurrencyInput
        name={`received-${item.row.installmentId}`}
        autoComplete="off"
        placeholder="R$ 0,00"
        size="sm"
        className="h-11 text-right font-numeric text-base sm:h-control-sm sm:text-control"
        value={amount}
        invalid={invalid || Boolean(error)}
        onValueChange={(value) =>
          state.dispatch({ type: "amount", id: item.row.installmentId, value })
        }
      />
      <FieldDescription className="sm:text-right" aria-live="polite">
        {invalid ? "Confira o valor recebido" : rowEffect(state.loading, preview)}
      </FieldDescription>
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
    item.amount === null ||
    (amount !== null && (amount <= 0 || (quote !== undefined && amount > quote.settlementCents)));
  return { amount, invalid };
}
