"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { Download, Paperclip, RotateCcw } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  financeReversePaymentInputSchema,
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_ACCEPT,
  type z,
} from "@lazuli/validators";
import {
  Button,
  CurrencyInput,
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

type Options = RouterOutputs["finance"]["paymentReversalOptions"];
type Method = RouterOutputs["finance"]["paymentMethods"][number];
type Kind = "CANCELLATION" | "REFUND";
export type Attempt = z.infer<typeof financeReversePaymentInputSchema>;

type FormProps = {
  options: Options;
  methods: Method[];
  methodsLoading: boolean;
  attempt: Attempt | null;
  uncertain: boolean;
  onAttemptChange: (attempt: Attempt | null) => void;
  onUncertainChange: (uncertain: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
};

const DATE_ONLY_LENGTH = 10;
const MAX_REFUND_REFERENCE_LENGTH = 120;
const MAX_REVERSAL_REASON_LENGTH = 500;

function initialAmounts(options: Options, attempt: Attempt | null): Record<string, number | null> {
  return Object.fromEntries(
    options.allocations.map((row) => [
      row.id,
      attempt?.allocations.find((line) => line.paymentAllocationId === row.id)?.amountCents ??
        (attempt ? 0 : row.availableAmountCents),
    ]),
  );
}

function reversalDefaults(
  attempt: Attempt | null,
  today: string,
): {
  kind: Kind;
  date: string;
  method: string;
  reference: string;
  reason: string;
} {
  return {
    kind: attempt?.kind ?? "CANCELLATION",
    date: attempt?.occurredOn?.toISOString().slice(0, DATE_ONLY_LENGTH) ?? today,
    method: attempt?.refundMethod ?? "",
    reference: attempt?.refundReference ?? "",
    reason: attempt?.reason ?? "",
  };
}

function selectedAllocations(
  options: Options,
  amounts: Record<string, number | null>,
): Attempt["allocations"] {
  return options.allocations.flatMap((row) => {
    const amountCents = amounts[row.id] ?? 0;
    return amountCents > 0 ? [{ paymentAllocationId: row.id, amountCents }] : [];
  });
}

const useReversalFields = (options: Options, attempt: Attempt | null) => {
  const today = saoPauloDateOnly(new Date());
  const defaults = reversalDefaults(attempt, today);
  const [kind, setKind] = useState<Kind>(defaults.kind);
  const [amounts, setAmounts] = useState<Record<string, number | null>>(() =>
    initialAmounts(options, attempt),
  );
  const [date, setDate] = useState(defaults.date);
  const [method, setMethod] = useState(defaults.method);
  const [reference, setReference] = useState(defaults.reference);
  const [reason, setReason] = useState(defaults.reason);
  const [proof, setProof] = useState<File | undefined>();
  const [error, setError] = useState("");
  const [committedId, setCommittedId] = useState<string | null>(null);
  const [uploadId] = useState(() => crypto.randomUUID());
  const [commandId] = useState(() => crypto.randomUUID());
  const reverse = trpc.finance.reversePayment.useMutation();
  const [uploading, setUploading] = useState(false);
  const allocations = selectedAllocations(options, amounts);
  const total = allocations.reduce((sum, row) => sum + row.amountCents, 0);
  const tooMuch = options.allocations.some(
    (row) => (amounts[row.id] ?? 0) > row.availableAmountCents,
  );
  const busy = reverse.isPending || uploading;
  const locked = busy || Boolean(attempt) || Boolean(committedId);
  return {
    today,
    kind,
    setKind,
    amounts,
    setAmounts,
    date,
    setDate,
    method,
    setMethod,
    reference,
    setReference,
    reason,
    setReason,
    proof,
    setProof,
    error,
    setError,
    committedId,
    setCommittedId,
    uploadId,
    commandId,
    reverse,
    uploading,
    setUploading,
    allocations,
    total,
    tooMuch,
    busy,
    locked,
  };
};

type ReversalFields = ReturnType<typeof useReversalFields>;

function useUploadAction(
  props: FormProps,
  state: ReversalFields,
): (reversalId: string) => Promise<void> {
  return async (reversalId) => {
    if (!state.proof) {
      await props.onSaved();
      return;
    }
    state.setUploading(true);
    props.onBusyChange(true);
    try {
      await uploadPaymentReversalProof({
        id: state.uploadId,
        paymentReversalId: reversalId,
        file: state.proof,
      });
      await props.onSaved();
    } catch (error_) {
      state.setError(
        `Operação registrada. O comprovante não foi enviado: ${error_ instanceof Error ? error_.message : "tente novamente."}`,
      );
    } finally {
      state.setUploading(false);
      props.onBusyChange(false);
    }
  };
}

function reversalErrorMessage(error_: Error | null, rejected: boolean): string {
  if (!rejected)
    return "Resultado ainda não confirmado. Recupere a mesma operação antes de continuar.";
  return error_ instanceof Error ? error_.message : "Não foi possível registrar a operação.";
}

function useConfirmAction(input: {
  props: FormProps;
  state: ReversalFields;
  upload: (reversalId: string) => Promise<void>;
}): (command: Attempt) => Promise<void> {
  const { props, state, upload } = input;
  return async (command) => {
    if (state.busy || state.committedId) return;
    state.setError("");
    props.onAttemptChange(command);
    props.onBusyChange(true);
    try {
      const result = await state.reverse.mutateAsync(command);
      props.onAttemptChange(null);
      props.onUncertainChange(false);
      state.setCommittedId(result.id);
      await (command.kind === "REFUND" && state.proof ? upload(result.id) : props.onSaved());
    } catch (error_) {
      const code = (error_ as { data?: { code?: string } })?.data?.code;
      const rejected = ["BAD_REQUEST", "CONFLICT", "FORBIDDEN"].includes(code ?? "");
      if (rejected) props.onAttemptChange(null);
      props.onUncertainChange(!rejected);
      state.setError(reversalErrorMessage(error_ instanceof Error ? error_ : null, rejected));
    } finally {
      props.onBusyChange(false);
    }
  };
}

function useSubmitAction(input: {
  props: FormProps;
  state: ReversalFields;
  confirm: (command: Attempt) => Promise<void>;
}): (event: FormEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const { props, state, confirm } = input;
    if (props.attempt || state.locked) return;
    void confirm({
      commandId: state.commandId,
      paymentEntryId: props.options.paymentEntryId,
      kind: state.kind,
      ...(state.kind === "REFUND"
        ? {
            occurredOn: new Date(`${state.date}T00:00:00.000Z`),
            refundMethod: state.method,
            refundReference: state.reference || null,
          }
        : {}),
      reason: state.reason || null,
      allocations: state.allocations,
    });
  };
}

export function PaymentReversalForm(props: FormProps): ReactElement {
  const state = useReversalFields(props.options, props.attempt);
  const upload = useUploadAction(props, state);
  const confirm = useConfirmAction({ props, state, upload });
  const submit = useSubmitAction({ props, state, confirm });
  return (
    <div className="grid content-start gap-4">
      <form className="grid gap-4" onSubmit={submit}>
        <ReversalKind state={state} />
        <ReversalAllocations options={props.options} state={state} />
        {state.kind === "REFUND" && <RefundFields props={props} state={state} />}
        <ReversalReason state={state} />
        {state.error && <ToastAlert variant="destructive">{state.error}</ToastAlert>}
        <ReversalSubmit props={props} state={state} upload={upload} confirm={confirm} />
      </form>
      <ReversalHistory props={props} />
    </div>
  );
}

function ReversalKind({ state }: { state: ReversalFields }): ReactElement {
  return (
    <>
      <SegmentedControl
        aria-label="Tipo da operação"
        value={state.kind}
        disabled={state.locked}
        onValueChange={(value) => {
          if (value === "CANCELLATION" || value === "REFUND") state.setKind(value);
        }}
      >
        <SegmentedControlItem value="CANCELLATION">Cancelar recebimento</SegmentedControlItem>
        <SegmentedControlItem value="REFUND">Estorno</SegmentedControlItem>
      </SegmentedControl>
      <p className="text-caption text-muted-foreground">
        {state.kind === "CANCELLATION"
          ? "Corrige um recebimento lançado por engano no mês original."
          : "Registra uma devolução já feita, na data em que ocorreu."}
      </p>
    </>
  );
}

function ReversalAllocations({
  options,
  state,
}: {
  options: Options;
  state: ReversalFields;
}): ReactElement {
  return (
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
            value={state.amounts[row.id] ?? null}
            disabled={state.locked || row.availableAmountCents === 0}
            onValueChange={(value) =>
              state.setAmounts((current) => ({ ...current, [row.id]: value }))
            }
          />
        </Field>
      ))}
      {options.unallocatedAmountCents > 0 && (
        <p className="text-caption text-muted-foreground">
          {formatBRLFromCents(options.unallocatedAmountCents)} sem parcela atribuída não pode ser
          revertido aqui.
        </p>
      )}
      <p className="text-right text-sm font-semibold">Total: {formatBRLFromCents(state.total)}</p>
    </div>
  );
}

function RefundFields({ props, state }: { props: FormProps; state: ReversalFields }): ReactElement {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <Label htmlFor="refund-date">Data da devolução</Label>
        <Input
          id="refund-date"
          size="sm"
          type="date"
          required
          min={props.options.date}
          max={state.today}
          value={state.date}
          disabled={state.locked}
          onChange={(event) => state.setDate(event.target.value)}
        />
      </Field>
      <Field>
        <Label htmlFor="refund-method">Forma da devolução</Label>
        <select
          id="refund-method"
          required
          value={state.method}
          disabled={state.locked || props.methodsLoading}
          onChange={(event) => state.setMethod(event.target.value)}
          className="h-control-sm rounded-sm border border-input bg-field px-3 text-control text-foreground"
        >
          <option value="">Selecione</option>
          {props.methods.map((item) => (
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
          maxLength={MAX_REFUND_REFERENCE_LENGTH}
          value={state.reference}
          disabled={state.locked}
          onChange={(event) => state.setReference(event.target.value)}
        />
      </Field>
      <RefundProofField state={state} />
    </div>
  );
}

function RefundProofField({ state }: { state: ReversalFields }): ReactElement {
  return (
    <div className="sm:col-span-2">
      <FileUpload
        compact
        value={state.proof ? [state.proof] : []}
        onValueChange={(files) => state.setProof(files[0])}
        onValidationError={state.setError}
        accept={PAYMENT_PROOF_ACCEPT}
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_PAYMENT_PROOF_BYTES}
        disabled={state.locked}
        status={state.uploading ? "uploading" : "idle"}
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
  );
}

function ReversalReason({ state }: { state: ReversalFields }): ReactElement {
  return (
    <Field>
      <Label htmlFor="reversal-reason">Justificativa (opcional)</Label>
      <Textarea
        id="reversal-reason"
        size="sm"
        rows={2}
        maxLength={MAX_REVERSAL_REASON_LENGTH}
        value={state.reason}
        disabled={state.locked}
        onChange={(event) => state.setReason(event.target.value)}
      />
    </Field>
  );
}

function ReversalSubmit({
  props,
  state,
  upload,
  confirm,
}: {
  props: FormProps;
  state: ReversalFields;
  upload: (reversalId: string) => Promise<void>;
  confirm: (command: Attempt) => Promise<void>;
}): ReactElement {
  const pendingAttempt = props.attempt;
  if (props.uncertain && pendingAttempt)
    return (
      <Button type="button" loading={state.busy} onClick={() => void confirm(pendingAttempt)}>
        Recuperar a mesma operação
      </Button>
    );
  const committedId = state.committedId;
  if (committedId && state.proof && state.error)
    return (
      <Button type="button" loading={state.uploading} onClick={() => void upload(committedId)}>
        Tentar enviar comprovante
      </Button>
    );
  return (
    <Button
      type="submit"
      disabled={
        state.total <= 0 ||
        state.tooMuch ||
        state.locked ||
        (state.kind === "REFUND" && !state.method)
      }
      loading={state.busy}
    >
      <RotateCcw aria-hidden="true" />{" "}
      {state.kind === "CANCELLATION" ? "Confirmar cancelamento" : "Registrar estorno"}
    </Button>
  );
}

function ReversalHistory({ props }: { props: FormProps }): ReactElement | null {
  if (props.options.reversals.length === 0) return null;
  return (
    <section className="grid gap-2 border-t border-border pt-3" aria-label="Histórico de reversões">
      <h3 className="text-sm font-semibold">Histórico deste recebimento</h3>
      {props.options.reversals.map((row) => (
        <ReversalHistoryRow
          key={row.id}
          row={row}
          onBusyChange={props.onBusyChange}
          onSaved={props.onSaved}
        />
      ))}
    </section>
  );
}

function ReversalHistoryRow({
  row,
  onBusyChange,
  onSaved,
}: {
  row: Options["reversals"][number];
  onBusyChange: FormProps["onBusyChange"];
  onSaved: FormProps["onSaved"];
}): ReactElement {
  return (
    <div className="rounded-sm border border-border p-2 text-caption">
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
        <ReversalProofAttach reversalId={row.id} onBusyChange={onBusyChange} onSaved={onSaved} />
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
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Não foi possível enviar o comprovante.");
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
