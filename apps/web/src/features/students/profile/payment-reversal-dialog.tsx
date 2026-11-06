"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { Check } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { financeReversePaymentInputSchema } from "@lazuli/validators";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  ToastAlert,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { PaymentReversalForm, type Attempt } from "./payment-reversal-form";
import { PaymentChoicesLoading, PaymentReversalLoading } from "./payment-reversal-loading";

type Payment = RouterOutputs["finance"]["studentPayments"]["rows"][number];
type Options = RouterOutputs["finance"]["paymentReversalOptions"];
type Method = RouterOutputs["finance"]["paymentMethods"][number];

function attemptKey(studentId: string): string {
  return `lazuli:payment-reversal-attempt:${studentId}`;
}

function savedAttempt(studentId: string): Attempt | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(attemptKey(studentId));
    if (!raw) return null;
    const parsed = financeReversePaymentInputSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function persistAttempt(studentId: string, value: Attempt | null): void {
  try {
    if (value) sessionStorage.setItem(attemptKey(studentId), JSON.stringify(value));
    else sessionStorage.removeItem(attemptKey(studentId));
  } catch {
    // The mounted dialog still retains the exact command if storage is unavailable.
  }
}

export function PaymentReversalDialog({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}): ReactElement {
  const [attempt, setAttempt] = useState<Attempt | null>(() => savedAttempt(studentId));
  const [uncertain, setUncertain] = useState(Boolean(attempt));
  const [selectedId, setSelectedId] = useState<string | null>(attempt?.paymentEntryId ?? null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const payments = trpc.finance.studentPayments.useInfiniteQuery(
    { studentId },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const rows = payments.data?.pages.flatMap((page) => page.rows) ?? [];
  const paymentId = selectedId ?? rows[0]?.id ?? null;
  const options = trpc.finance.paymentReversalOptions.useQuery(
    { paymentEntryId: paymentId ?? "" },
    { enabled: Boolean(paymentId) },
  );
  const methods = trpc.finance.paymentMethods.useQuery();
  const utils = trpc.useUtils();

  function retainAttempt(value: Attempt | null): void {
    setAttempt(value);
    persistAttempt(studentId, value);
  }

  async function refresh(): Promise<void> {
    await Promise.allSettled([
      options.refetch(),
      payments.refetch(),
      utils.finance.installments.invalidate(),
      utils.finance.studentSummary.invalidate(),
      utils.finance.studentPayments.invalidate(),
      utils.dashboard.invalidate(),
      utils.activity.invalidate(),
    ]);
    setVersion((current) => current + 1);
  }

  return (
    <PaymentReversalDialogView
      rows={rows}
      paymentId={paymentId}
      paymentPending={payments.isPending}
      paymentError={payments.isError}
      hasNextPage={payments.hasNextPage}
      fetchingNextPage={payments.isFetchingNextPage}
      onLoadMore={() => void payments.fetchNextPage()}
      onSelect={setSelectedId}
      options={options.data}
      optionsPending={options.isPending}
      optionsError={options.isError}
      methods={methods.data ?? []}
      methodsLoading={methods.isPending}
      attempt={attempt}
      uncertain={uncertain}
      busy={busy}
      version={version}
      onAttemptChange={retainAttempt}
      onUncertainChange={setUncertain}
      onBusyChange={setBusy}
      onSaved={refresh}
      onClose={onClose}
    />
  );
}

type DialogViewProps = {
  rows: Payment[];
  paymentId: string | null;
  paymentPending: boolean;
  paymentError: boolean;
  hasNextPage: boolean | undefined;
  fetchingNextPage: boolean;
  onLoadMore: () => void;
  onSelect: (id: string) => void;
  options: Options | undefined;
  optionsPending: boolean;
  optionsError: boolean;
  methods: Method[];
  methodsLoading: boolean;
  attempt: Attempt | null;
  uncertain: boolean;
  busy: boolean;
  version: number;
  onAttemptChange: (attempt: Attempt | null) => void;
  onUncertainChange: (uncertain: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
  onClose: () => void;
};

function PaymentReversalDialogView(props: DialogViewProps): ReactElement {
  const popup = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const focusFirstControl = (): HTMLElement | null => {
    const control = popup.current?.querySelector<HTMLElement>(
      '[data-payment-choice][aria-pressed="true"]:not(:disabled), form button:not(:disabled)',
    );
    if (control) focused.current = true;
    return control ?? null;
  };
  useEffect(() => {
    if (!focused.current) focusFirstControl()?.focus();
  }, [props.paymentPending, props.optionsPending]);
  return (
    <Dialog
      open
      onOpenChange={(open, event) => {
        if (!open && (props.busy || props.attempt)) event.cancel();
        else if (!open) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-[min(72rem,calc(100vw-2rem))]"
          motion="subtle"
          ref={popup}
          initialFocus={() => focusFirstControl() ?? popup.current ?? true}
          showCloseButton={!props.busy && !props.attempt}
        >
          <DialogHeader>
            <DialogTitle>Cancelar ou estornar recebimento</DialogTitle>
            <DialogDescription>
              Escolha um recebimento e os valores das parcelas que serão reabertos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-5">
            <div className="flex flex-col gap-5 md:flex-row">
              <PaymentList {...props} />
              <ReversalPanel {...props} />
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PaymentList(props: DialogViewProps): ReactElement {
  return (
    <section className="relative w-full min-w-0 shrink-0 md:w-56" aria-label="Recebimentos">
      <div className="grid min-h-0 gap-2 md:absolute md:inset-0 md:flex md:flex-col">
        <h3 className="text-control font-semibold text-heading">Recebimentos</h3>
        <div className="scrollbar-subtle grid min-h-0 max-h-40 content-start gap-2 overflow-y-auto py-1 pr-4 pl-1 md:max-h-none md:flex-1">
          {props.paymentPending && <PaymentChoicesLoading />}
          {props.paymentError && (
            <ToastAlert variant="destructive">
              Não foi possível carregar os recebimentos.
            </ToastAlert>
          )}
          {!props.paymentPending && props.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum recebimento para este aluno.</p>
          )}
          {props.rows.map((payment) => (
            <PaymentChoice
              key={payment.id}
              payment={payment}
              selected={payment.id === props.paymentId}
              disabled={props.busy || Boolean(props.attempt)}
              onSelect={() => props.onSelect(payment.id)}
            />
          ))}
          {props.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              loading={props.fetchingNextPage}
              onClick={props.onLoadMore}
            >
              Carregar mais
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReversalPanel(props: DialogViewProps): ReactElement {
  return (
    <section
      className="min-w-0 flex-1 border-t border-border pt-4 md:min-h-64 md:border-t-0 md:border-l md:pt-0 md:pl-5"
      aria-label="Operação sobre o recebimento"
    >
      {(props.paymentPending || (props.optionsPending && props.paymentId)) && (
        <PaymentReversalLoading />
      )}
      {props.optionsError && (
        <ToastAlert variant="destructive">Não foi possível carregar as parcelas.</ToastAlert>
      )}
      {props.options && props.options.paymentEntryId === props.paymentId && (
        <PaymentReversalForm
          key={`${props.paymentId}:${props.version}`}
          options={props.options}
          methods={props.methods}
          methodsLoading={props.methodsLoading}
          attempt={props.attempt}
          uncertain={props.uncertain}
          onAttemptChange={props.onAttemptChange}
          onUncertainChange={props.onUncertainChange}
          onBusyChange={props.onBusyChange}
          onSaved={props.onSaved}
        />
      )}
    </section>
  );
}

function PaymentChoice({
  payment,
  selected,
  disabled,
  onSelect,
}: {
  payment: Payment;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-payment-choice
      disabled={disabled}
      onClick={onSelect}
      className="grid w-full gap-1 rounded-md border border-border p-2.5 text-left text-caption outline-none transition-colors duration-fast ease-standard hover:bg-accent focus-visible:border-ring focus-visible:shadow-focus aria-pressed:border-primary aria-pressed:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-disabled"
    >
      <span className="flex justify-between gap-2 font-medium">
        <span className="flex min-w-0 items-start gap-1.5">
          {selected && <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />}
          <span>{paymentInstallmentLabel(payment)}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap font-numeric tabular-nums">
          {formatBRLFromCents(payment.amountCents)}
        </span>
      </span>
      <span className="text-muted-foreground">
        {formatDateOnlyBR(payment.date)} · {payment.paymentMethod.name}
      </span>
      {payment.reversals.length > 0 && (
        <span className="text-caption text-muted-foreground">
          {payment.reversals.length} reversão(ões) registrada(s)
        </span>
      )}
    </button>
  );
}

function paymentInstallmentLabel(payment: Payment): string {
  const sequences = [
    ...new Set(
      payment.installments
        .filter((installment) => installment.kind !== "MATERIAL")
        .map((installment) => installment.sequenceNumber),
    ),
  ].toSorted((left, right) => left - right);
  const labels: string[] = [];
  if (sequences.length > 0)
    labels.push(`${sequences.length === 1 ? "Parcela" : "Parcelas"} ${sequences.join(", ")}`);
  if (payment.installments.some((installment) => installment.kind === "MATERIAL"))
    labels.push("Material didático");
  return labels.join(" · ") || "Recebimento";
}
