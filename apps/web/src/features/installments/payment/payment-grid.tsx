import { useId, useState, type ReactElement, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import {
  Button,
  CurrencyInput,
  Field,
  FieldDescription,
  FieldError,
  Label,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@lazuli/ui";
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

export function PaymentAllocation({
  item,
  state,
}: {
  item: DraftItem;
  state: PaymentFormState;
}): ReactElement {
  const receipt = draftReceipts(state.draft, state.preview).find(
    (entry) => entry.commandId === item.receiptId,
  );
  const items = state.draft.items.filter((entry) => entry.receiptId === item.receiptId);
  return (
    <div className="space-y-2 border-t border-border pt-3 text-caption text-muted-foreground">
      <p>Pagador: {item.row.payer.name}</p>
      <p>Recebido anteriormente nesta parcela: {money(item.row.paidAmountCents)}</p>
      {items.length > 1 && (
        <>
          <p>Parcelas no mesmo recebimento:</p>
          <ul className="space-y-1">
            {items.map((entry) => (
              <li key={entry.row.installmentId} className="flex justify-between gap-3">
                <span>
                  {entry.row.beneficiaries.map((person) => person.fullName).join(", ")}
                  {" · "}
                  {originLabel(entry.row.origin)} {entry.row.sequenceNumber}/
                  {entry.row.scheduleTotal}
                </span>
                <span className="shrink-0 font-numeric">
                  {money(
                    receipt?.allocations.find(
                      (allocation) => allocation.installmentId === entry.row.installmentId,
                    )?.amountCents ?? 0,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>O saldo considera os encargos novos e o desconto elegível na data efetiva.</p>
    </div>
  );
}

export function PaymentReceiptGroup({
  items,
  total,
  children,
}: {
  items: DraftItem[];
  total: number;
  children: ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">Pagador</p>
          <h3 id={id} className="break-words text-control font-semibold">
            {items[0]?.row.payer.name}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="max-w-32 text-caption text-muted-foreground sm:max-w-none">
            {items.length} {items.length === 1 ? "parcela" : "parcelas"} · 1 recebimento
          </p>
          <p className="font-numeric text-control font-medium">{money(total)}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function PaymentRowActions({
  item,
  state,
  details,
  setDetails,
}: {
  item: DraftItem;
  state: PaymentFormState;
  details: boolean;
  setDetails: (value: boolean) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const locked = state.submitting || state.uncertain;
  const act = (action: () => void): void => {
    action();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={locked}
        aria-label={`Ações da parcela ${item.row.sequenceNumber} de ${item.row.payer.name}`}
        render={
          <Button type="button" size="icon-sm" className="size-11 sm:size-8" variant="ghost" />
        }
      >
        <Ellipsis aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" size="sm" showArrow={false} className="grid gap-1">
        <PopoverTitle className="sr-only">Ações da parcela</PopoverTitle>
        <Button
          type="button"
          variant="ghost"
          disabled={locked}
          className="justify-start"
          onClick={() => act(() => setDetails(!details))}
        >
          {details ? "Ocultar detalhes" : "Ver detalhes e alocação"}
        </Button>
        <ReceiptMutationActions item={item} state={state} act={act} />
      </PopoverContent>
    </Popover>
  );
}

function ReceiptMutationActions({
  item,
  state,
  act,
}: {
  item: DraftItem;
  state: PaymentFormState;
  act: (action: () => void) => void;
}): ReactElement {
  const locked = state.submitting || state.uncertain;
  const canSplit = state.draft.items.filter((row) => row.receiptId === item.receiptId).length > 1;
  return (
    <>
      {canSplit && (
        <Button
          type="button"
          variant="ghost"
          disabled={locked}
          className="justify-start"
          onClick={() =>
            act(() =>
              state.dispatch({
                type: "split",
                id: item.row.installmentId,
                receiptId: crypto.randomUUID(),
              }),
            )
          }
        >
          Separar recebimento
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={locked}
        className="justify-start"
        onClick={() => act(() => state.dispatch({ type: "remove", id: item.row.installmentId }))}
      >
        Remover recebível
      </Button>
    </>
  );
}
