"use client";
import { CalendarDays, Check, Wallet } from "lucide-react";
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
  FormSection,
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
import { PaymentSummary } from "./payment-summary";
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
          className="md:max-w-[min(72rem,calc(100vw-2rem))]"
          ref={popup}
          initialFocus={() =>
            popup.current?.querySelector<HTMLInputElement>(
              state.draft.items.length > 0 ? 'input[name^="received-"]' : 'input[name="search"]',
            ) ??
            popup.current?.querySelector<HTMLInputElement>('input[name="date"]') ??
            true
          }
        >
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2.5">
                <Wallet className="size-5 text-muted-foreground" aria-hidden />
                Registrar pagamento
              </span>
            </DialogTitle>
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
        <fieldset disabled={state.submitting || state.uncertain} className="min-w-0">
          <legend className="sr-only">Dados do recebimento</legend>
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
            <div className="grid min-w-0 grid-cols-1 content-start gap-3">
              {children}
              <PaymentGrid state={state} />
            </div>
            <div className="grid min-w-0 content-start gap-5 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <PaymentFields state={state} />
              <PaymentSummary state={state} />
            </div>
          </div>
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
    <FormSection
      title={
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden /> Dados do recebimento
        </span>
      }
    >
      <FormRow className="sm:grid-cols-2 lg:grid-cols-1">
        <Field className="max-w-36">
          <Label>Data do recebimento</Label>
          <Input
            name="date"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            size="sm"
            className="font-numeric"
            value={state.draft.date}
            invalid={invalid}
            onChange={(event) =>
              state.dispatch({ type: "date", value: maskDateBR(event.target.value) })
            }
          />
          {invalid && <FieldError match>Informe uma data válida.</FieldError>}
        </Field>
        <PaymentMethod state={state} />
      </FormRow>
      <p className="text-caption text-muted-foreground">
        Juros e descontos calculados na data do recebimento.
      </p>
    </FormSection>
  );
}

function PaymentMethod({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <Field className="max-w-56">
      <Label id="payment-method-label">Forma de pagamento</Label>
      <Select
        value={state.draft.method}
        onValueChange={(value) => {
          const parsed = paymentMethodSchema.safeParse(value);
          if (parsed.success) state.dispatch({ type: "method", value: parsed.data });
        }}
      >
        <SelectTrigger size="sm" aria-labelledby="payment-method-label">
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
  const disabled =
    state.submitting || (!state.uncertain && (state.loading || state.draft.items.length === 0));
  return (
    <DialogFooter className="mt-5 border-t border-border pt-4">
      <div className="mr-auto self-center text-caption" aria-live="polite">
        <p className="flex items-baseline gap-3">
          <span className="text-muted-foreground">Total recebido</span>
          <span className="font-numeric text-control font-semibold">{money(total)}</span>
        </p>
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
          <Check className="size-4" aria-hidden />
        </Button>
      </div>
    </DialogFooter>
  );
}

function submissionLabel(state: PaymentFormState, total: number): string {
  if (state.submitting) return "Registrando…";
  return state.uncertain ? "Verificar registro" : `Registrar ${money(total)}`;
}
