"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { CircleX, Paperclip, RotateCcw } from "lucide-react";
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
  FieldError,
  FormRow,
  FormSection,
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

import { maskDateBR, parseDateBR } from "~/lib/masks";
import { ReversalHistory } from "./payment-reversal-history";

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

type ReversalFields = {
  today: string;
  kind: Kind;
  setKind: (kind: Kind) => void;
  amounts: Record<string, number | null>;
  setAmounts: (
    update: (current: Record<string, number | null>) => Record<string, number | null>,
  ) => void;
  date: string;
  setDate: (date: string) => void;
  method: string;
  setMethod: (method: string) => void;
  reference: string;
  setReference: (reference: string) => void;
  reason: string;
  setReason: (reason: string) => void;
  proof: File | undefined;
  setProof: (proof: File | undefined) => void;
  error: string;
  setError: (error: string) => void;
  committedId: string | null;
  setCommittedId: (id: string | null) => void;
  uploadId: string;
  commandId: string;
  reverse: { isPending: boolean; mutateAsync: (command: Attempt) => Promise<{ id: string }> };
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
  allocations: Attempt["allocations"];
  total: number;
  tooMuch: boolean;
  busy: boolean;
  locked: boolean;
};

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
    kind: attempt?.kind ?? "REFUND",
    date: defaultRefundDate(attempt, today),
    method: attempt?.refundMethod ?? "",
    reference: attempt?.refundReference ?? "",
    reason: attempt?.reason ?? "",
  };
}

function defaultRefundDate(attempt: Attempt | null, today: string): string {
  return formatDateOnlyBR(attempt?.occurredOn?.toISOString().slice(0, DATE_ONLY_LENGTH) ?? today);
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

function reversalTotals(
  options: Options,
  amounts: Record<string, number | null>,
): {
  allocations: Attempt["allocations"];
  total: number;
  tooMuch: boolean;
} {
  const allocations = selectedAllocations(options, amounts);
  return {
    allocations,
    total: allocations.reduce((sum, row) => sum + row.amountCents, 0),
    tooMuch: options.allocations.some((row) => (amounts[row.id] ?? 0) > row.availableAmountCents),
  };
}

const useReversalFields = (options: Options, attempt: Attempt | null): ReversalFields => {
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
  const { allocations, total, tooMuch } = reversalTotals(options, amounts);
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

function isReversalRejected(error_: Error | null): boolean {
  const code = (error_ as { data?: { code?: string } } | null)?.data?.code;
  return ["BAD_REQUEST", "CONFLICT", "FORBIDDEN"].includes(code ?? "");
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
      const failure = error_ instanceof Error ? error_ : null;
      const rejected = isReversalRejected(failure);
      if (rejected) props.onAttemptChange(null);
      props.onUncertainChange(!rejected);
      state.setError(reversalErrorMessage(failure, rejected));
    } finally {
      props.onBusyChange(false);
    }
  };
}

function validRefundDate(date: string | null, range: { earliest: string; today: string }): boolean {
  return date !== null && date >= range.earliest && date <= range.today;
}

function useSubmitAction(input: {
  props: FormProps;
  state: ReversalFields;
  confirm: (command: Attempt) => Promise<void>;
}): (event: FormEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const { props, state, confirm } = input;
    if (props.attempt || state.locked || disabledSubmit(state)) return;
    const date = parseDateBR(state.date);
    if (
      state.kind === "REFUND" &&
      !validRefundDate(date, { earliest: props.options.date, today: state.today })
    ) {
      state.setError("Informe uma data válida entre o recebimento e hoje.");
      event.currentTarget.querySelector<HTMLInputElement>('[name="refund-date"]')?.focus();
      return;
    }
    void confirm({
      commandId: state.commandId,
      paymentEntryId: props.options.paymentEntryId,
      kind: state.kind,
      ...(state.kind === "REFUND"
        ? {
            occurredOn: new Date(`${date}T00:00:00.000Z`),
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
      <form className="grid gap-4" noValidate onSubmit={submit}>
        <ReversalKind state={state} />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className={state.kind === "REFUND" ? "grid gap-4" : "contents"}>
            <ReversalAllocations options={props.options} state={state} />
            <ReversalReason state={state} />
          </div>
          {state.kind === "REFUND" && (
            <div className="min-w-0 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              <RefundFields props={props} state={state} />
            </div>
          )}
        </div>
        {state.error && <ToastAlert variant="destructive">{state.error}</ToastAlert>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="grid gap-0.5" aria-live="polite" aria-atomic="true">
            <span className="text-caption text-muted-foreground">Total a reabrir</span>
            <span className="font-numeric text-lg font-semibold tabular-nums">
              {formatBRLFromCents(state.total)}
            </span>
          </div>
          <ReversalSubmit props={props} state={state} upload={upload} confirm={confirm} />
        </div>
      </form>
      <ReversalHistory props={props} />
    </div>
  );
}

function ReversalKind({ state }: { state: ReversalFields }): ReactElement {
  return (
    <div className="grid gap-2">
      <SegmentedControl
        size="sm"
        aria-label="Tipo da operação"
        value={state.kind}
        disabled={state.locked}
        onValueChange={(value) => {
          if (value === "CANCELLATION" || value === "REFUND") state.setKind(value);
        }}
      >
        <SegmentedControlItem value="REFUND">
          <RotateCcw aria-hidden="true" className="mr-1.5 size-3.5 shrink-0" />
          Estorno
        </SegmentedControlItem>
        <SegmentedControlItem value="CANCELLATION">
          <CircleX aria-hidden="true" className="mr-1.5 size-3.5 shrink-0" />
          Cancelar recebimento
        </SegmentedControlItem>
      </SegmentedControl>
      <p className="text-caption text-muted-foreground">
        {state.kind === "CANCELLATION"
          ? "Corrige um recebimento lançado por engano no mês original."
          : "Registra uma devolução já feita, na data em que ocorreu."}
      </p>
    </div>
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
    <FormSection title="Parcelas deste recebimento">
      {options.allocations.map((row) => (
        <Field key={row.id}>
          <div className="flex items-center gap-3">
            <Label htmlFor={`reversal-${row.id}`} className="min-w-0 flex-1">
              <span className="block truncate">
                {row.kind === "MATERIAL" ? "Material" : `Parcela ${row.sequenceNumber}`}
              </span>
              <span className="block text-caption font-normal text-muted-foreground">
                Vence {formatDateOnlyBR(row.dueDate)} · disponível:{" "}
                {formatBRLFromCents(row.availableAmountCents)}
              </span>
            </Label>
            <div className="w-28 shrink-0">
              <CurrencyInput
                id={`reversal-${row.id}`}
                name={`reversal-${row.id}`}
                autoComplete="off"
                placeholder="R$ 0,00"
                aria-invalid={(state.amounts[row.id] ?? 0) > row.availableAmountCents || undefined}
                aria-describedby={
                  (state.amounts[row.id] ?? 0) > row.availableAmountCents
                    ? `reversal-error-${row.id}`
                    : undefined
                }
                size="sm"
                value={state.amounts[row.id] ?? null}
                disabled={state.locked || row.availableAmountCents === 0}
                onValueChange={(value) =>
                  state.setAmounts((current) => ({ ...current, [row.id]: value }))
                }
              />
            </div>
          </div>
          {(state.amounts[row.id] ?? 0) > row.availableAmountCents && (
            <div>
              <FieldError id={`reversal-error-${row.id}`} match>
                O valor supera o disponível nesta parcela.
              </FieldError>
            </div>
          )}
        </Field>
      ))}
      {options.unallocatedAmountCents > 0 && (
        <p className="text-caption text-muted-foreground">
          {formatBRLFromCents(options.unallocatedAmountCents)} sem parcela atribuída não pode ser
          revertido aqui.
        </p>
      )}
    </FormSection>
  );
}

function RefundFields({ props, state }: { props: FormProps; state: ReversalFields }): ReactElement {
  const date = parseDateBR(state.date);
  const invalidDate =
    Boolean(state.error) &&
    !validRefundDate(date, { earliest: props.options.date, today: state.today });
  return (
    <FormSection title="Dados da devolução">
      <FormRow columns={2}>
        <Field>
          <Label htmlFor="refund-date">Data da devolução</Label>
          <Input
            id="refund-date"
            size="sm"
            name="refund-date"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            maxLength={DATE_ONLY_LENGTH}
            aria-invalid={invalidDate || undefined}
            aria-describedby={invalidDate ? "refund-date-error" : undefined}
            value={state.date}
            disabled={state.locked}
            onChange={(event) => {
              state.setDate(maskDateBR(event.target.value));
              state.setError("");
            }}
          />
          {invalidDate && (
            <FieldError id="refund-date-error" match>
              Informe uma data entre o recebimento e hoje.
            </FieldError>
          )}
        </Field>
        <Field>
          <Label htmlFor="refund-method">Forma da devolução</Label>
          <select
            id="refund-method"
            name="refund-method"
            autoComplete="off"
            required
            value={state.method}
            disabled={state.locked || props.methodsLoading}
            onChange={(event) => state.setMethod(event.target.value)}
            className="h-control-sm w-full min-w-0 rounded-sm border border-input bg-field px-3 text-control text-foreground outline-none focus-visible:border-ring focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-disabled"
          >
            <option value="">Selecione</option>
            {props.methods.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </FormRow>
      <Field>
        <Label htmlFor="refund-reference">Referência da transação (opcional)</Label>
        <Input
          id="refund-reference"
          name="refund-reference"
          autoComplete="off"
          placeholder="Código ou identificação da transação"
          size="sm"
          maxLength={MAX_REFUND_REFERENCE_LENGTH}
          value={state.reference}
          disabled={state.locked}
          onChange={(event) => state.setReference(event.target.value)}
        />
      </Field>
      <RefundProofField state={state} />
    </FormSection>
  );
}

function RefundProofField({ state }: { state: ReversalFields }): ReactElement {
  return (
    <div className="min-w-0">
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
            <Paperclip aria-hidden="true" /> Anexar comprovante (opcional)
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
        name="reversal-reason"
        autoComplete="off"
        placeholder="Descreva o motivo, se necessário"
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
    <Button type="submit" disabled={disabledSubmit(state)} loading={state.busy}>
      <RotateCcw aria-hidden="true" />{" "}
      {state.kind === "CANCELLATION" ? "Confirmar cancelamento" : "Registrar estorno"}
    </Button>
  );
}

function disabledSubmit(state: ReversalFields): boolean {
  return (
    state.total <= 0 || state.tooMuch || state.locked || (state.kind === "REFUND" && !state.method)
  );
}
