"use client";
import { useEffect, useRef } from "react";
import { ArrowRight, CalendarClock, Check, Handshake, Pencil, UserRound } from "lucide-react";
import {
  Alert,
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
import { formatBRLFromCents as money, formatDateOnlyBR as date } from "~/lib/format";
import { originLabel } from "~/features/installments/view-model";
import { treatmentGroups } from "./treatment-groups";
import { TreatmentConditions, TreatmentInstallments } from "./treatment-fields";
import { useTreatment, type TreatmentReview } from "./use-treatment";

const FORM_ID = "financial-treatment";
export function TreatmentDialog({
  studentId,
  onClose,
  initialIds = [],
  onConfirmed,
}: {
  studentId?: string;
  initialIds?: string[];
  onClose: () => void;
  onConfirmed?: () => void;
}) {
  const state = useTreatment(studentId, initialIds, onClose, onConfirmed);
  const content = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const firstField = () =>
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
  const reviewTotal = state.review?.result.lines.reduce(
    (sum, line) => sum + line.resultingBalanceCents,
    0,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={content}
          className={state.batch ? "md:max-w-[min(72rem,calc(100vw-2rem))]" : "md:max-w-5xl"}
          initialFocus={firstField}
        >
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2.5">
                <Handshake className="size-5 text-muted-foreground" aria-hidden />
                {state.review ? "Conferir acordo" : "Tratativa financeira"}
              </span>
            </DialogTitle>
            <DialogDescription>
              {state.review
                ? "Confira o efeito em cada parcela antes de confirmar."
                : state.batch
                  ? "Negocie as parcelas por aluno e revise as condições de todo o lote."
                  : "Selecione as parcelas e defina as condições combinadas com o responsável."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody ref={state.body} className="mt-5">
            <form
              id={FORM_ID}
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
                    batch={state.batch}
                  />
                ) : (
                  <div
                    className={
                      state.batch
                        ? "grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6"
                        : "grid min-w-0 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-6"
                    }
                  >
                    <TreatmentInstallments state={state} />
                    <div
                      className={
                        state.batch
                          ? "min-w-0 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
                          : "min-w-0 border-t border-border pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6"
                      }
                    >
                      <TreatmentConditions state={state} />
                    </div>
                  </div>
                )}
              </fieldset>
            </form>
            {state.error && (
              <Alert variant="destructive" className="mt-4">
                {state.error}
              </Alert>
            )}
          </DialogBody>
          <DialogFooter className="mt-5 border-t border-border pt-4">
            <div
              className="mr-auto self-center text-caption text-muted-foreground"
              aria-live="polite"
            >
              {state.review ? (
                <>
                  Saldo após acordo{" "}
                  <span className="ml-2 font-numeric text-control font-semibold text-foreground">
                    {money(reviewTotal ?? 0)}
                  </span>
                </>
              ) : state.batch ? (
                "O lote é confirmado por inteiro e registrado por aluno."
              ) : (
                "O acordo fica registrado no histórico do aluno."
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={state.pending}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                size="sm"
                disabled={
                  state.pending ||
                  state.available.isPending ||
                  state.available.isError ||
                  !state.rows.length
                }
              >
                {state.pending
                  ? state.review
                    ? "Confirmando…"
                    : "Preparando…"
                  : state.review
                    ? "Confirmar acordo"
                    : "Revisar acordo"}
                {state.review ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <ArrowRight className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function TreatmentReviewPanel({
  review,
  onEdit,
  batch,
}: {
  review: TreatmentReview;
  onEdit: () => void;
  batch: boolean;
}) {
  const reduction = review.result.lines.reduce((sum, line) => sum + line.reductionCents, 0);
  return (
    <div
      className={
        batch
          ? "grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6"
          : "grid min-w-0 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-6"
      }
    >
      <section className="min-w-0" aria-label="Parcelas do acordo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-control font-semibold text-heading">
            {review.result.lines.length} parcela{review.result.lines.length === 1 ? "" : "s"} no
            acordo
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden /> Alterar
          </Button>
        </div>
        <div className="scrollbar-subtle max-h-96 overflow-y-auto lg:max-h-[min(32rem,calc(100dvh-24rem))]">
          {treatmentGroups(review.result.lines).map((group) => (
            <section key={group.key} aria-label={group.name}>
              {batch && (
                <div className="grid gap-1 border-y border-border bg-muted px-3 py-2">
                  <h3 className="flex min-w-0 items-start gap-2 text-caption font-semibold">
                    <UserRound
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 break-words">{group.name}</span>
                  </h3>
                  <p className="pl-5 text-caption text-muted-foreground">
                    {group.rows.length} parcela{group.rows.length === 1 ? "" : "s"} · Saldo após
                    acordo{" "}
                    <span className="font-numeric font-medium text-foreground">
                      {money(group.rows.reduce((sum, line) => sum + line.resultingBalanceCents, 0))}
                    </span>
                  </p>
                </div>
              )}
              <ul className="divide-y divide-border px-3">
                {group.rows.map((line) => (
                  <li key={line.installmentId} className="grid gap-1.5 py-3 text-caption">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <strong className="font-medium">
                        {originLabel(line.origin)} · {line.sequenceNumber}
                      </strong>
                      <span className="flex items-center gap-2 font-numeric">
                        <span className="text-muted-foreground">{money(line.balanceCents)}</span>
                        <ArrowRight className="size-3" aria-label="para" />
                        <span className="font-semibold">{money(line.resultingBalanceCents)}</span>
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {line.reductionCents === 0 && !line.newDueDate
                        ? "Sem alteração nesta parcela"
                        : line.reductionCents > 0
                          ? `Redução de ${money(line.reductionCents)} em encargos`
                          : "Sem redução de encargos"}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {line.newDueDate
                        ? `${date(line.previousDueDate)} → ${date(line.newDueDate)}`
                        : `Vencimento mantido em ${date(line.previousDueDate)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
      <section
        className={
          batch
            ? "grid min-w-0 content-start gap-4 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
            : "grid min-w-0 content-start gap-4 border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6"
        }
        aria-label="Resumo do acordo"
      >
        <h3 className="text-control font-semibold text-heading">Condições combinadas</h3>
        {reduction > 0 && (
          <p className="text-caption">
            <span className="font-numeric font-semibold">{money(reduction)}</span> de redução nos
            encargos em aberto.
          </p>
        )}
        {review.request.newDueDate && (
          <p className="text-caption">
            Cobrança suspensa até <strong>{date(review.request.newDueDate)}</strong>, novo
            vencimento das parcelas selecionadas. Sem novos juros durante a suspensão.
          </p>
        )}
        <div className="grid gap-1.5">
          <h4 className="text-caption text-muted-foreground">Motivo</h4>
          <p className="whitespace-pre-wrap break-words text-control">{review.reason}</p>
        </div>
        <p className="text-caption text-muted-foreground">
          Pagamentos anteriores e valor principal preservados. Esta confirmação registra o acordo; o
          recebimento é lançado separadamente.
        </p>
      </section>
    </div>
  );
}
