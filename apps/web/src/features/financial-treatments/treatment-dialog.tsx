"use client";
import { useEffect, useRef, type ReactElement } from "react";
import { ArrowRight, Check, Handshake } from "lucide-react";
import {
  ToastAlert,
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
import { formatBRLFromCents as money } from "~/lib/format";
import { FinancialDialogLoading } from "./financial-dialog-loading";
import { TreatmentConditions, TreatmentInstallments } from "./treatment-fields";
import { TreatmentReviewPanel } from "./treatment-review";
import { useTreatment, type TreatmentState } from "./use-treatment";

export const TREATMENT_FORM_ID = "financial-treatment";
export type TreatmentDialogProps = {
  studentId?: string;
  initialIds?: string[];
  onClose: () => void;
  onConfirmed?: () => void;
};
export function TreatmentDialog({
  studentId,
  initialIds = [],
  onClose,
  onConfirmed,
}: TreatmentDialogProps): ReactElement {
  const state = useTreatment({ studentId, initialIds, onClose, onConfirmed });
  const content = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const firstField = (): HTMLElement | null =>
    content.current?.querySelector<HTMLElement>(
      state.showAll
        ? '[data-slot="checkbox"]'
        : '#treatment-until, input[name^="reduction-"], [data-slot="checkbox"]',
    ) ?? content.current;
  useEffect(() => {
    if (state.available.isPending || initialized.current) return;
    initialized.current = true;
    firstField()?.focus({ preventScroll: true });
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.isLocked()) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={content}
          className="md:max-w-5xl"
          initialFocus={firstField}
          data-student-dialog-motion
        >
          <TreatmentHeader review={Boolean(state.review)} />
          <DialogBody ref={state.body}>
            {state.available.isPending ? (
              <FinancialDialogLoading />
            ) : (
              <TreatmentForm state={state} />
            )}
            {state.error && <ToastAlert variant="destructive">{state.error}</ToastAlert>}
          </DialogBody>
          <TreatmentFooter state={state} onClose={onClose} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function TreatmentHeader({ review }: { review: boolean }): ReactElement {
  return (
    <DialogHeader>
      <DialogTitle>
        <span className="flex items-center gap-2">
          <Handshake className="size-5 text-muted-foreground" aria-hidden />
          {review ? "Conferir acordo" : "Tratativa financeira"}
        </span>
      </DialogTitle>
      <DialogDescription>
        {review
          ? "Confira o efeito em cada parcela antes de confirmar."
          : "Selecione as parcelas e defina as condições combinadas com o responsável."}
      </DialogDescription>
    </DialogHeader>
  );
}
export function TreatmentForm({ state }: { state: TreatmentState }): ReactElement {
  return (
    <form
      id={TREATMENT_FORM_ID}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void state.submit();
      }}
    >
      <fieldset disabled={state.pending} className="min-w-0">
        <legend className="sr-only">Condições da tratativa financeira</legend>
        {state.review ? (
          <TreatmentReviewPanel
            review={state.review}
            onEdit={state.edit}
            locked={state.uncertain}
          />
        ) : (
          <div className="grid min-w-0 gap-5 md:grid-cols-2 md:gap-6">
            <TreatmentInstallments state={state} />
            <div className="min-w-0 border-t border-border pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <TreatmentConditions state={state} />
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}
export function TreatmentFooter({
  state,
  onClose,
}: {
  state: TreatmentState;
  onClose: () => void;
}): ReactElement {
  const total = state.review?.result.lines.reduce(
    (sum, line) => sum + line.resultingBalanceCents,
    0,
  );
  return (
    <DialogFooter>
      <div className="mr-auto self-center text-caption text-muted-foreground" aria-live="polite">
        {state.review ? (
          <>
            Saldo após acordo{" "}
            <strong className="font-numeric text-foreground">{money(total ?? 0)}</strong>
          </>
        ) : (
          "O acordo fica registrado no histórico do aluno."
        )}
      </div>
      <TreatmentActions state={state} onClose={onClose} />
    </DialogFooter>
  );
}

function TreatmentActions({
  state,
  onClose,
}: {
  state: TreatmentState;
  onClose: () => void;
}): ReactElement {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={state.pending || state.uncertain}
        onClick={() => {
          if (!state.isLocked()) onClose();
        }}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={TREATMENT_FORM_ID}
        size="sm"
        disabled={
          state.pending ||
          (!state.review &&
            (state.available.isPending || state.available.isError || state.rows.length === 0))
        }
      >
        {state.pending ? "Aguarde…" : treatmentLabel(state)}
        {state.review ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <ArrowRight className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
function treatmentLabel(state: TreatmentState): string {
  if (state.uncertain) return "Verificar confirmação";
  return state.review ? "Confirmar acordo" : "Revisar acordo";
}
