"use client";

import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import {
  ToastAlert,
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogPortal,
} from "@lazuli/ui";
import {
  contractRenegotiationConfirmSchema,
  contractRenegotiationPreviewSchema,
  type ContractRenegotiationConfirm,
  type ContractRenegotiationPreview,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { FinancialDialogLoading } from "~/features/financial-treatments/financial-dialog-loading";
import { ContractTerminationDialog } from "./contract-termination-dialog";
import { ContractRenegotiationMode } from "./contract-renegotiation-mode";
import styles from "./contract-renegotiation-dialog.module.css";
import {
  RenegotiationFields,
  RenegotiationHistory,
  RenegotiationReview,
} from "./contract-renegotiation-fields";

export type RenegotiationOptions = RouterOutputs["finance"]["renegotiationOptions"];
export type RenegotiationPreview = RouterOutputs["finance"]["previewRenegotiation"];
const editSchema = contractRenegotiationPreviewSchema.extend({
  reason: contractRenegotiationConfirmSchema.shape.reason,
});

export function ContractRenegotiationDialog({
  contractId,
  onClose,
}: {
  contractId: string;
  onClose: () => void;
}): ReactElement {
  const [mode, setMode] = useState<"reduce" | "terminate">("reduce");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          data-size="wide"
          data-layout="termination"
          showCloseButton={!busy}
          className={`${styles.content} md:w-[calc(100vw-3rem)] md:max-w-[1120px] [&>[data-slot=dialog-footer]]:mt-4`}
        >
          {mode === "terminate" ? (
            <ContractTerminationDialog
              contractId={contractId}
              onClose={onClose}
              onReduce={() => setMode("reduce")}
              onBusyChange={setBusy}
            />
          ) : (
            <ReductionDialog
              contractId={contractId}
              onClose={onClose}
              onTerminate={() => setMode("terminate")}
              onBusyChange={setBusy}
            />
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function ReductionDialog({
  contractId,
  onClose,
  onTerminate,
  onBusyChange,
}: {
  contractId: string;
  onClose: () => void;
  onTerminate: () => void;
  onBusyChange: (busy: boolean) => void;
}): ReactElement {
  const options = trpc.finance.renegotiationOptions.useQuery(
    { contractId },
    { retry: false, refetchOnWindowFocus: false },
  );
  if (options.data)
    return (
      <ReductionForm
        options={options.data}
        onClose={onClose}
        onTerminate={onTerminate}
        onBusyChange={onBusyChange}
      />
    );
  return (
    <TaskDialog
      embedded
      title="Renegociar contrato"
      description="Confira as condições antes de confirmar."
      layout="termination"
      bodyLayout="termination"
      size="wide"
      compactHeader
      actionSize="sm"
      onClose={onClose}
      pending={false}
      formId="renegotiation-loading"
      firstField="renegotiation-amount"
      submitLabel="Revisar renegociação"
      submitDisabled
      error={options.error?.message}
    >
      <ContractRenegotiationMode value="reduce" onChange={onTerminate} />
      {options.isPending ? (
        <FinancialDialogLoading termination />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => void options.refetch()}>
          <RefreshCw aria-hidden /> Tentar novamente
        </Button>
      )}
    </TaskDialog>
  );
}

function ReductionForm({
  options,
  onClose,
  onTerminate,
  onBusyChange,
}: {
  options: RenegotiationOptions;
  onClose: () => void;
  onTerminate: () => void;
  onBusyChange: (busy: boolean) => void;
}): ReactElement {
  const utils = trpc.useUtils();
  const draft = useReductionDraft();
  const save = trpc.finance.confirmRenegotiation.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      onClose();
    },
  });
  const pending = draft.loading || save.isPending;
  useEffect(() => onBusyChange(pending), [onBusyChange, pending]);
  const submit = createReductionSubmit({
    ...draft,
    options,
    pending,
    confirm: (input) => save.mutate(input),
    preview: (input) => utils.finance.previewRenegotiation.fetch(input),
  });
  function back(): void {
    draft.setReview(null);
    draft.setAcknowledged(false);
    draft.setError(undefined);
    save.reset();
    draft.setCommandId(crypto.randomUUID());
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("#renegotiation-amount")?.focus(),
    );
  }
  return (
    <ReductionFormView
      {...draft}
      options={options}
      onClose={onClose}
      onTerminate={onTerminate}
      pending={pending}
      back={back}
      submit={submit}
      saveError={save.error?.message}
      saveFailed={Boolean(save.error)}
    />
  );
}

type ReductionFormViewProps = {
  options: RenegotiationOptions;
  onClose: () => void;
  onTerminate: () => void;
  pending: boolean;
  validation: ReturnType<typeof useValidation>;
  review: RenegotiationPreview | null;
  back: () => void;
  acknowledged: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  reason: string;
  ids: string[];
  amount: number | null;
  setIds: (ids: string[]) => void;
  setAmount: (amount: number | null) => void;
  setReason: (reason: string) => void;
  setAcknowledged: (acknowledged: boolean) => void;
  error: string | undefined;
  saveError: string | undefined;
  saveFailed: boolean;
};

type ReductionDraft = Pick<
  ReductionFormViewProps,
  | "validation"
  | "ids"
  | "amount"
  | "reason"
  | "review"
  | "acknowledged"
  | "error"
  | "setIds"
  | "setAmount"
  | "setReason"
  | "setAcknowledged"
> & {
  loading: boolean;
  commandId: string;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  setReview: (review: RenegotiationPreview | null) => void;
  setCommandId: (commandId: string) => void;
};

function useReductionDraft(): ReductionDraft {
  const validation = useValidation();
  const [ids, setIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<RenegotiationPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  return {
    validation,
    ids,
    setIds,
    amount,
    setAmount,
    reason,
    setReason,
    review,
    setReview,
    acknowledged,
    setAcknowledged,
    loading,
    setLoading,
    error,
    setError,
    commandId,
    setCommandId,
  };
}

function ReductionFormView(props: ReductionFormViewProps): ReactElement {
  const { options, onClose, onTerminate, pending, validation, review, back, acknowledged } = props;
  return (
    <TaskDialog
      embedded
      title="Renegociar contrato"
      description={options.studentName}
      layout="termination"
      bodyLayout="termination"
      size="wide"
      compactHeader
      actionSize="sm"
      onClose={onClose}
      pending={pending}
      formId="contract-renegotiation"
      firstField="renegotiation-amount"
      bodyRef={validation.body}
      onBack={review ? back : undefined}
      submitLabel={review ? "Confirmar renegociação" : "Revisar renegociação"}
      submitIcon={review ? <Check aria-hidden /> : <ArrowRight aria-hidden />}
      submitDisabled={options.lines.length === 0 || Boolean(review && !acknowledged)}
    >
      <ContractRenegotiationMode
        value="reduce"
        disabled={pending || Boolean(review)}
        onChange={onTerminate}
      />
      <ReductionFormBody {...props} />
    </TaskDialog>
  );
}

function ReductionFormBody(props: ReductionFormViewProps): ReactElement {
  const { options, error, saveError, saveFailed, back, submit } = props;
  return (
    <form
      id="contract-renegotiation"
      noValidate
      onSubmit={(event) => void submit(event)}
      className="grid gap-3"
    >
      <Alert className="py-2 text-caption">
        <strong>Medida excepcional, de último recurso.</strong>
        <p>
          Use quando as condições habituais não forem suficientes para manter o contrato. A redução
          pode ficar abaixo da faixa de descontos autorizada.
        </p>
      </Alert>
      <ReductionFormFields {...props} />
      {(error ?? saveError) && <ToastAlert variant="destructive">{error ?? saveError}</ToastAlert>}
      {saveFailed && (
        <Button size="sm" type="button" variant="secondary" onClick={back}>
          <RefreshCw aria-hidden /> Atualizar prévia
        </Button>
      )}
      <RenegotiationHistory history={options.history} />
    </form>
  );
}

function ReductionFormFields({
  options,
  pending,
  review,
  reason,
  acknowledged,
  setAcknowledged,
  ids,
  amount,
  validation,
  setIds,
  setAmount,
  setReason,
}: ReductionFormViewProps): ReactElement {
  return (
    <fieldset disabled={pending} className="grid gap-3">
      {review ? (
        <>
          <RenegotiationReview preview={review} reason={reason} />
          <ReductionAcknowledgment
            review={review}
            acknowledged={acknowledged}
            onChange={setAcknowledged}
          />
        </>
      ) : (
        <RenegotiationFields
          options={options}
          ids={ids}
          amount={amount}
          reason={reason}
          errors={validation.errors}
          onIds={(next) => {
            setIds(next);
            validation.clear("installmentIds");
          }}
          onAmount={(next) => {
            setAmount(next);
            validation.clear("newAmountCents");
          }}
          onReason={(next) => {
            setReason(next);
            validation.clear("reason");
          }}
        />
      )}
    </fieldset>
  );
}

function ReductionAcknowledgment({
  review,
  acknowledged,
  onChange,
}: {
  review: RenegotiationPreview;
  acknowledged: boolean;
  onChange: (acknowledged: boolean) => void;
}): ReactElement {
  return (
    <label className="flex items-start gap-2 rounded-sm border p-2.5 text-caption">
      <Checkbox checked={acknowledged} onCheckedChange={onChange} />
      <span>
        Conferi as {review.lines.length} parcelas e autorizo a redução total de{" "}
        {money(review.reductionCents)}.
      </span>
    </label>
  );
}

type ReductionSubmitParams = {
  options: RenegotiationOptions;
  ids: string[];
  amount: number | null;
  reason: string;
  review: RenegotiationPreview | null;
  acknowledged: boolean;
  commandId: string;
  pending: boolean;
  validation: ReturnType<typeof useValidation>;
  confirm: (input: ContractRenegotiationConfirm) => void;
  preview: (input: ContractRenegotiationPreview) => Promise<RenegotiationPreview>;
  setError: (error: string | undefined) => void;
  setLoading: (loading: boolean) => void;
  setReview: (review: RenegotiationPreview | null) => void;
};

function createReductionSubmit({
  options,
  ids,
  amount,
  reason,
  review,
  acknowledged,
  commandId,
  pending,
  validation,
  confirm,
  preview,
  setError,
  setLoading,
  setReview,
}: ReductionSubmitParams): (event: FormEvent<HTMLFormElement>) => Promise<void> {
  return async (event) => {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    const values = validation.validate(editSchema, {
      contractId: options.contractId,
      installmentIds: ids,
      newAmountCents: amount,
      reason,
    });
    if (!values) return;
    if (review) {
      const confirmed = validation.validate(contractRenegotiationConfirmSchema, {
        ...values,
        commandId,
        version: review.version,
        acknowledged,
      });
      if (confirmed) confirm(confirmed);
      return;
    }
    setLoading(true);
    try {
      const { reason: _reason, ...request } = values;
      setReview(await preview(request));
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Não foi possível preparar a renegociação.",
      );
    } finally {
      setLoading(false);
    }
  };
}
