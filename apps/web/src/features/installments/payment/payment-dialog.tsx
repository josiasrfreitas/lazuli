"use client";
import { useRef, type ReactNode, type ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  FormRow,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { paymentMethodSchema } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useScrollToError } from "~/lib/scroll-to-error";
import { usePaymentForm, type PaymentFormState } from "./logic";
import { PaymentGrid } from "./payment-grid";
import { PaymentPicker } from "./payment-picker";
import { draftReceipts } from "./draft";
const FORM_ID = "register-payments";
const METHOD_LABELS = {
  PIX: "PIX",
  CASH: "Dinheiro",
  TRANSFER: "Transferência",
  CARD: "Cartão",
  CHEQUE: "Cheque",
  BOLETO: "Boleto",
  OTHER: "Outro",
};
type Props = {
  open: boolean;
  rows: FinanceInstallmentRow[];
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
};
export function PaymentDialog(props: Props): ReactElement {
  const state = usePaymentForm({ rows: props.rows, onRegistered: props.onRegistered });
  const popup = useRef<HTMLDivElement>(null);
  const close = (open: boolean): void => {
    if (!state.isSubmitting()) props.onOpenChange(open);
  };
  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-180 [&_button]:min-h-11 sm:[&_button]:min-h-0"
          ref={popup}
          initialFocus={() =>
            popup.current?.querySelector<HTMLInputElement>('input[name="date"]') ?? true
          }
        >
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Informe quando e como recebeu. Confira os valores de cada parcela.
            </DialogDescription>
          </DialogHeader>
          <PaymentForm state={state}>
            <PaymentPicker state={state} />
          </PaymentForm>
          <PaymentFooter state={state} onClose={() => close(false)} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
export function PaymentForm({
  state,
  children,
}: {
  state: PaymentFormState;
  children: ReactNode;
}): ReactElement {
  const body = useScrollToError(state.revision);
  return (
    <DialogBody className="mt-5" ref={body}>
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          state.submit();
        }}
      >
        <fieldset disabled={state.submitting || state.uncertain} className="grid min-w-0 gap-4">
          <PaymentFields state={state} />
          {children}
          <PaymentGrid state={state} />
        </fieldset>
      </form>
      {state.error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive p-3 text-caption text-destructive"
        >
          <p>{state.error}</p>
          {!state.uncertain && (
            <Button type="button" size="sm" variant="secondary" onClick={state.refresh}>
              Atualizar prévia e conferir
            </Button>
          )}
        </div>
      )}
      {state.uncertain && (
        <p role="status" className="mt-3 text-caption">
          O resultado ainda não foi confirmado. Verifique o registro para recuperar a mesma
          operação, sem duplicar o pagamento.
        </p>
      )}
    </DialogBody>
  );
}

function PaymentFields({ state }: { state: PaymentFormState }): ReactElement {
  const invalid = state.revision > 0 && !parseDateBR(state.draft.date);
  return (
    <FormRow className="grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:grid-cols-[9rem_12rem_minmax(0,1fr)]">
      <Field>
        <Label>Data do recebimento</Label>
        <Input
          name="date"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          size="sm"
          className="h-11 font-numeric text-base sm:h-control-sm sm:text-control"
          value={state.draft.date}
          invalid={invalid}
          onChange={(event) =>
            state.dispatch({ type: "date", value: maskDateBR(event.target.value) })
          }
        />
        {invalid && <FieldError match>Informe uma data válida.</FieldError>}
      </Field>
      <PaymentMethod state={state} />
      <p className="col-span-2 text-caption text-muted-foreground sm:col-span-1 sm:self-end">
        Juros e descontos calculados na data do recebimento.
      </p>
    </FormRow>
  );
}

function PaymentMethod({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <Field>
      <Label id="payment-method-label">Forma de pagamento</Label>
      <Select
        value={state.draft.method}
        onValueChange={(value) => {
          const parsed = paymentMethodSchema.safeParse(value);
          if (parsed.success) state.dispatch({ type: "method", value: parsed.data });
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-11 text-base sm:h-control-sm sm:text-control"
          aria-labelledby="payment-method-label"
        >
          <SelectValue>{METHOD_LABELS[state.draft.method]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {paymentMethodSchema.options.map((method) => (
            <SelectItem key={method} value={method}>
              {METHOD_LABELS[method]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
function PaymentFooter({
  state,
  onClose,
}: {
  state: PaymentFormState;
  onClose: () => void;
}): ReactElement {
  const total = draftReceipts(state.draft, state.preview).reduce(
    (sum, receipt) => sum + receipt.amountCents,
    0,
  );
  const remaining = state.preview.reduce(
    (sum, row) => sum + (row.line?.quote.remainingCents ?? 0),
    0,
  );
  const disabled =
    state.submitting || (!state.uncertain && (state.loading || state.draft.items.length === 0));
  return (
    <DialogFooter className="mt-4 flex-col items-stretch border-t border-border pt-4 sm:items-center">
      <div className="mr-auto space-y-1 text-caption" aria-live="polite">
        <p className="flex items-baseline gap-3">
          <span className="text-muted-foreground">Total recebido</span>
          <span className="font-numeric text-h3 font-semibold">{money(total)}</span>
        </p>
        {state.draft.items.length > 0 && (
          <p className="text-muted-foreground">{remainingLabel(state, remaining)}</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={state.submitting}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button type="submit" form={FORM_ID} size="sm" disabled={disabled}>
          {submissionLabel(state, total)}
        </Button>
      </div>
    </DialogFooter>
  );
}

function submissionLabel(state: PaymentFormState, total: number): string {
  if (state.submitting) return "Registrando…";
  return state.uncertain ? "Verificar registro" : `Registrar ${money(total)}`;
}

function remainingLabel(state: PaymentFormState, remaining: number): string {
  if (state.loading) return "Calculando prévia…";
  if (state.preview.length !== state.draft.items.length || state.preview.some((row) => !row.line))
    return "Saldo após pagamento: prévia indisponível";
  return `Saldo após pagamento: ${money(remaining)}`;
}
