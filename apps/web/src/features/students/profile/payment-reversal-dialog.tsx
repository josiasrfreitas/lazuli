"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { Download, Paperclip, RotateCcw } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { saoPauloDateOnly } from "@lazuli/domain";
import { MAX_PAYMENT_PROOF_BYTES, PAYMENT_PROOF_ACCEPT } from "@lazuli/validators";
import {
  Button,
  CurrencyInput,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Field,
  FileUpload,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Textarea,
  ToastAlert,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { uploadPaymentReversalProof } from "~/features/installments/payment/payment-reversal-proof";

type Payment = RouterOutputs["finance"]["studentPayments"]["rows"][number];
type Options = RouterOutputs["finance"]["paymentReversalOptions"];
type Method = RouterOutputs["finance"]["paymentMethods"][number];
type Kind = "CANCELLATION" | "REFUND";

export function PaymentReversalDialog({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    <Dialog
      open
      onOpenChange={(open, event) => {
        if (!open && busy) event.cancel();
        else if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="h-160 md:max-w-4xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Cancelar ou estornar recebimento</DialogTitle>
            <DialogDescription>
              Escolha um recebimento e os valores das parcelas que serão reabertos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid content-start gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <section className="grid min-w-0 content-start gap-2" aria-label="Recebimentos">
              {payments.isPending && <p role="status">Carregando recebimentos…</p>}
              {payments.isError && (
                <ToastAlert variant="destructive">
                  Não foi possível carregar os recebimentos.
                </ToastAlert>
              )}
              {!payments.isPending && rows.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum recebimento para este aluno.</p>
              )}
              {rows.map((payment) => (
                <PaymentChoice
                  key={payment.id}
                  payment={payment}
                  selected={payment.id === paymentId}
                  onSelect={() => setSelectedId(payment.id)}
                />
              ))}
              {payments.hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={payments.isFetchingNextPage}
                  onClick={() => void payments.fetchNextPage()}
                >
                  Carregar mais
                </Button>
              )}
            </section>
            <section className="min-w-0" aria-label="Operação sobre o recebimento">
              {options.isPending && paymentId && <p role="status">Carregando parcelas…</p>}
              {options.isError && (
                <ToastAlert variant="destructive">
                  Não foi possível carregar as parcelas.
                </ToastAlert>
              )}
              {options.data && options.data.paymentEntryId === paymentId && (
                <PaymentReversalForm
                  key={`${paymentId}:${version}`}
                  options={options.data}
                  methods={methods.data ?? []}
                  methodsLoading={methods.isPending}
                  onBusyChange={setBusy}
                  onSaved={refresh}
                />
              )}
            </section>
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PaymentChoice({
  payment,
  selected,
  onSelect,
}: {
  payment: Payment;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
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

function PaymentReversalForm({
  options,
  methods,
  methodsLoading,
  onBusyChange,
  onSaved,
}: {
  options: Options;
  methods: Method[];
  methodsLoading: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}): ReactElement {
  const today = saoPauloDateOnly(new Date());
  const [kind, setKind] = useState<Kind>("CANCELLATION");
  const [amounts, setAmounts] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(options.allocations.map((row) => [row.id, row.availableAmountCents])),
  );
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<File | undefined>();
  const [error, setError] = useState("");
  const [committedId, setCommittedId] = useState<string | null>(null);
  const [uploadId] = useState(() => crypto.randomUUID());
  const [commandId] = useState(() => crypto.randomUUID());
  const reverse = trpc.finance.reversePayment.useMutation();
  const [uploading, setUploading] = useState(false);
  const allocations = options.allocations.flatMap((row) => {
    const amountCents = amounts[row.id] ?? 0;
    return amountCents > 0 ? [{ paymentAllocationId: row.id, amountCents }] : [];
  });
  const total = allocations.reduce((sum, row) => sum + row.amountCents, 0);
  const tooMuch = options.allocations.some(
    (row) => (amounts[row.id] ?? 0) > row.availableAmountCents,
  );
  const busy = reverse.isPending || uploading;

  async function upload(reversalId: string): Promise<void> {
    if (!proof) {
      await onSaved();
      return;
    }
    setUploading(true);
    onBusyChange(true);
    try {
      await uploadPaymentReversalProof({
        id: uploadId,
        paymentReversalId: reversalId,
        file: proof,
      });
      await onSaved();
    } catch (cause) {
      setError(
        `Operação registrada. O comprovante não foi enviado: ${cause instanceof Error ? cause.message : "tente novamente."}`,
      );
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || committedId) return;
    setError("");
    onBusyChange(true);
    try {
      const result = await reverse.mutateAsync({
        commandId,
        paymentEntryId: options.paymentEntryId,
        kind,
        ...(kind === "REFUND"
          ? {
              occurredOn: new Date(`${date}T00:00:00.000Z`),
              refundMethod: method,
              refundReference: reference || null,
            }
          : {}),
        reason: reason || null,
        allocations,
      });
      setCommittedId(result.id);
      if (kind === "REFUND" && proof) await upload(result.id);
      else await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a operação.");
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="grid content-start gap-4">
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <SegmentedControl
          aria-label="Tipo da operação"
          value={kind}
          disabled={busy || Boolean(committedId)}
          onValueChange={(value) => {
            if (value === "CANCELLATION" || value === "REFUND") setKind(value);
          }}
        >
          <SegmentedControlItem value="CANCELLATION">Cancelar recebimento</SegmentedControlItem>
          <SegmentedControlItem value="REFUND">Estorno</SegmentedControlItem>
        </SegmentedControl>
        <p className="text-caption text-muted-foreground">
          {kind === "CANCELLATION"
            ? "Corrige um recebimento lançado por engano no mês original."
            : "Registra uma devolução já feita, na data em que ocorreu."}
        </p>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Parcelas deste recebimento</h3>
          {options.allocations.map((row) => (
            <Field key={row.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-3">
              <Label htmlFor={`reversal-${row.id}`} className="min-w-0">
                <span className="block truncate">
                  {row.kind === "MATERIAL" ? "Material" : `Parcela ${row.sequenceNumber}`}
                </span>
                <span className="block text-caption font-normal text-muted-foreground">
                  Vence {formatDateOnlyBR(row.dueDate)} · disponível:{" "}
                  {formatBRLFromCents(row.availableAmountCents)}
                </span>
              </Label>
              <CurrencyInput
                id={`reversal-${row.id}`}
                size="sm"
                value={amounts[row.id] ?? null}
                disabled={busy || Boolean(committedId) || row.availableAmountCents === 0}
                onValueChange={(value) =>
                  setAmounts((current) => ({ ...current, [row.id]: value }))
                }
              />
            </Field>
          ))}
          {options.unallocatedAmountCents > 0 && (
            <p className="text-caption text-muted-foreground">
              {formatBRLFromCents(options.unallocatedAmountCents)} sem parcela atribuída não pode
              ser revertido aqui.
            </p>
          )}
          <p className="text-right text-sm font-semibold">Total: {formatBRLFromCents(total)}</p>
        </div>
        {kind === "REFUND" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="refund-date">Data da devolução</Label>
              <Input
                id="refund-date"
                size="sm"
                type="date"
                required
                min={options.date}
                max={today}
                value={date}
                disabled={busy}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="refund-method">Forma da devolução</Label>
              <select
                id="refund-method"
                required
                value={method}
                disabled={busy || methodsLoading}
                onChange={(event) => setMethod(event.target.value)}
                className="h-control-sm rounded-sm border border-input bg-field px-3 text-control text-foreground"
              >
                <option value="">Selecione</option>
                {methods.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field className="sm:col-span-2">
              <Label htmlFor="refund-reference">Referência da transação (opcional)</Label>
              <Input
                id="refund-reference"
                size="sm"
                maxLength={120}
                value={reference}
                disabled={busy}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <FileUpload
                compact
                value={proof ? [proof] : []}
                onValueChange={(files) => setProof(files[0])}
                onValidationError={setError}
                accept={PAYMENT_PROOF_ACCEPT}
                acceptLabel="PDF, JPG ou PNG"
                maxSize={MAX_PAYMENT_PROOF_BYTES}
                disabled={busy || Boolean(committedId)}
                status={uploading ? "uploading" : "idle"}
                renderTrigger={(picker) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={picker.disabled}
                    onClick={picker.open}
                  >
                    <Paperclip aria-hidden="true" /> Comprovante da devolução (opcional)
                  </Button>
                )}
              />
            </div>
          </div>
        )}
        <Field>
          <Label htmlFor="reversal-reason">Justificativa (opcional)</Label>
          <Textarea
            id="reversal-reason"
            size="sm"
            rows={2}
            maxLength={500}
            value={reason}
            disabled={busy || Boolean(committedId)}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
        {committedId && proof && error ? (
          <Button type="button" loading={uploading} onClick={() => void upload(committedId)}>
            Tentar enviar comprovante
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={
              total <= 0 || tooMuch || Boolean(committedId) || (kind === "REFUND" && !method)
            }
            loading={busy}
          >
            <RotateCcw aria-hidden="true" />{" "}
            {kind === "CANCELLATION" ? "Confirmar cancelamento" : "Registrar estorno"}
          </Button>
        )}
      </form>
      {options.reversals.length > 0 && (
        <section
          className="grid gap-2 border-t border-border pt-3"
          aria-label="Histórico de reversões"
        >
          <h3 className="text-sm font-semibold">Histórico deste recebimento</h3>
          {options.reversals.map((row) => (
            <div key={row.id} className="rounded-sm border border-border p-2 text-caption">
              <div className="flex justify-between gap-2 font-medium">
                <span>
                  {row.kind === "CANCELLATION" ? "Cancelamento" : "Estorno"} ·{" "}
                  {formatDateOnlyBR(row.occurredOn)}
                </span>
                <span>{formatBRLFromCents(row.amountCents)}</span>
              </div>
              <p className="text-muted-foreground">
                {row.createdByName}
                {row.refundMethodName ? ` · ${row.refundMethodName}` : ""}
                {row.refundReference ? ` · ${row.refundReference}` : ""}
              </p>
              {row.reason && <p>{row.reason}</p>}
              {row.proofs.map((file) => (
                <a
                  key={file.id}
                  href={`/api/payment-reversal-proofs/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-interactive underline-offset-4 hover:underline"
                >
                  <Download aria-hidden="true" className="size-3" />
                  {file.fileName}
                </a>
              ))}
              {row.kind === "REFUND" && (
                <ReversalProofAttach
                  reversalId={row.id}
                  onBusyChange={onBusyChange}
                  onSaved={onSaved}
                />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function ReversalProofAttach({
  reversalId,
  onBusyChange,
  onSaved,
}: {
  reversalId: string;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}): ReactElement {
  const [file, setFile] = useState<File | undefined>();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function attach(): Promise<void> {
    if (!file || uploading) return;
    setError("");
    setUploading(true);
    onBusyChange(true);
    try {
      await uploadPaymentReversalProof({ id, paymentReversalId: reversalId, file });
      setFile(undefined);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o comprovante.");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="grid gap-1 pt-1">
      <FileUpload
        compact
        value={file ? [file] : []}
        onValueChange={(files) => {
          setFile(files[0]);
          setId(crypto.randomUUID());
          setError("");
        }}
        onValidationError={setError}
        accept={PAYMENT_PROOF_ACCEPT}
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_PAYMENT_PROOF_BYTES}
        disabled={uploading}
        status={uploading ? "uploading" : "idle"}
        renderTrigger={(picker) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={picker.disabled}
            onClick={picker.open}
          >
            <Paperclip aria-hidden="true" /> Anexar comprovante
          </Button>
        )}
      />
      {file && (
        <Button
          type="button"
          size="sm"
          loading={uploading}
          disabled={Boolean(error)}
          onClick={() => void attach()}
        >
          Salvar comprovante
        </Button>
      )}
      {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
    </div>
  );
}
