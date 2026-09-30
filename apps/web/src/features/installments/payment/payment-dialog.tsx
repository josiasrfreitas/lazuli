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
} from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents as money } from "~/lib/format";
import { useScrollToError } from "~/features/students/new-student/use-scroll-to-error";
import { usePaymentForm, type PaymentFormState } from "./logic";
import { PaymentFields } from "./payment-fields";
import { PaymentGrid } from "./payment-grid";
import { PaymentPicker } from "./payment-picker";
import { PaymentReceipts } from "./payment-receipts";
import { draftReceipts } from "./draft";
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
    if (!state.isSubmitting()) props.onOpenChange(open);
  };
  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-4xl"
          ref={popup}
          initialFocus={() =>
            popup.current?.querySelector<HTMLInputElement>('input[name="date"]') ?? true
          }
        >
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Confira os recebíveis e os valores na data efetiva. Edite o recebido para registrar um
              parcial.
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
    <DialogBody className="mt-4" ref={body}>
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          state.submit();
        }}
      >
        <fieldset disabled={state.submitting || state.uncertain} className="grid min-w-0 gap-3">
          <PaymentFields state={state} />
          {children}
          <PaymentGrid state={state} />
          {state.draft.items.length > 0 && <PaymentReceipts state={state} />}
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
  return (
    <DialogFooter className="items-stretch sm:items-center">
      <div className="mr-auto text-caption">
        <p>
          Total recebido <strong className="font-numeric">{money(total)}</strong>
        </p>
        <p className="text-muted-foreground">{remainingLabel(state, remaining)}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" disabled={state.submitting} onClick={onClose}>
        Fechar
      </Button>
      <Button
        type="submit"
        form={FORM_ID}
        size="sm"
        disabled={state.submitting || (state.loading && !state.uncertain)}
      >
        {submissionLabel(state)}
      </Button>
    </DialogFooter>
  );
}

function submissionLabel(state: PaymentFormState): string {
  if (state.submitting) return "Registrando…";
  return state.uncertain ? "Verificar registro" : "Registrar pagamento";
}

function remainingLabel(state: PaymentFormState, remaining: number): string {
  if (state.loading) return "Calculando prévia…";
  if (state.preview.length !== state.draft.items.length || state.preview.some((row) => !row.line))
    return "Saldo resultante: prévia indisponível";
  return `Saldo resultante: ${money(remaining)}`;
}
