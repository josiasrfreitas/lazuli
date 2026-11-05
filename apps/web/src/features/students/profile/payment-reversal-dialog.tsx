"use client";

import { useState, type ReactElement } from "react";
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
          className="h-160 md:max-w-4xl"
          showCloseButton={!props.busy && !props.attempt}
        >
          <DialogHeader>
            <DialogTitle>Cancelar ou estornar recebimento</DialogTitle>
            <DialogDescription>
              Escolha um recebimento e os valores das parcelas que serão reabertos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid content-start gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <PaymentList {...props} />
            <ReversalPanel {...props} />
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PaymentList(props: DialogViewProps): ReactElement {
  return (
    <section className="grid min-w-0 content-start gap-2" aria-label="Recebimentos">
      {props.paymentPending && <p role="status">Carregando recebimentos…</p>}
      {props.paymentError && (
        <ToastAlert variant="destructive">Não foi possível carregar os recebimentos.</ToastAlert>
      )}
      {!props.paymentPending && props.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum recebimento para este aluno.</p>
      )}
      {props.rows.map((payment) => (
        <PaymentChoice
          key={payment.id}
          payment={payment}
          selected={payment.id === props.paymentId}
          disabled={Boolean(props.attempt)}
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
    </section>
  );
}

function ReversalPanel(props: DialogViewProps): ReactElement {
  return (
    <section className="min-w-0" aria-label="Operação sobre o recebimento">
      {props.optionsPending && props.paymentId && <p role="status">Carregando parcelas…</p>}
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
      disabled={disabled}
      onClick={onSelect}
      className="grid w-full gap-1 rounded-md border border-border p-3 text-left text-sm hover:bg-accent aria-pressed:border-primary aria-pressed:bg-accent/40"
    >
      <span className="flex justify-between gap-2 font-medium">
        <span>{formatDateOnlyBR(payment.date)}</span>
        <span className="font-numeric tabular-nums">{formatBRLFromCents(payment.amountCents)}</span>
      </span>
      <span className="truncate text-caption text-muted-foreground">
        {payment.payer.name} · {payment.paymentMethod.name}
      </span>
      {payment.reversals.length > 0 && (
        <span className="text-caption text-muted-foreground">
          {payment.reversals.length} reversão(ões) registrada(s)
        </span>
      )}
    </button>
  );
}
