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
} from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { useScrollToError } from "~/lib/scroll-to-error";
import { usePaymentForm, type PaymentFormState } from "./logic";
import { PaymentSummary } from "./payment-summary";
import { PaymentGrid } from "./payment-grid";
import { PaymentPicker } from "./payment-picker";
import { draftReceipts } from "./draft";
import { PaymentMethodField } from "./payment-method-field";
const FORM_ID = "register-payments";

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
    if (state.isSubmitting()) return;
    if (!open && state.registered) state.finish();
    else props.onOpenChange(open);
  };
  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-[min(72rem,calc(100vw-2rem))]"
          data-student-dialog-motion
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
              Informe quando e como recebeu. Confira os valores de cada cobrança.
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
    <DialogBody className="mt-3" ref={body}>
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          state.submit();
        }}
      >
        <fieldset
          disabled={state.submitting || state.uncertain || state.registered}
          className="min-w-0"
        >
          <legend className="sr-only">Dados do recebimento</legend>
          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] md:gap-5">
            <div className="grid min-w-0 grid-cols-1 content-start gap-3">
              {children}
              <PaymentGrid state={state} />
            </div>
            <div className="grid min-w-0 content-start gap-4 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-5">
              <PaymentFields state={state} />
              <PaymentSummary state={state} />
            </div>
          </div>
        </fieldset>
      </form>
      <PaymentFormNotice state={state} />
    </DialogBody>
  );
}

function PaymentFormNotice({ state }: { state: PaymentFormState }): ReactElement {
  return (
    <>
      {state.error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive p-3 text-caption text-destructive"
        >
          <p>{state.error}</p>
          {!state.uncertain && !state.registered && (
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
    </>
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
      <FormRow className="grid-cols-2">
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
        <PaymentMethodField state={state} />
      </FormRow>
      <p className="text-caption text-muted-foreground">
        Juros e descontos calculados na data do recebimento.
      </p>
    </FormSection>
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
    state.submitting ||
    (!state.uncertain && !state.registered && (state.loading || state.draft.items.length === 0));
  return (
    <DialogFooter className="mt-3 border-t border-border pt-3">
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
          onClick={state.registered ? state.finish : onClose}
        >
          {state.registered ? "Concluir sem reenviar" : "Cancelar"}
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
  if (state.uploading) return "Enviando comprovante…";
  if (state.registered && !state.submitting) return "Reenviar comprovante";
  if (state.submitting) return "Registrando…";
  return state.uncertain ? "Verificar registro" : `Registrar ${money(total)}`;
}
