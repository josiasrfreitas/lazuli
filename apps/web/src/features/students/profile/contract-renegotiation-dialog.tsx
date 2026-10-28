"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import { Alert, Button, Checkbox } from "@lazuli/ui";
import {
  contractRenegotiationConfirmSchema,
  contractRenegotiationPreviewSchema,
} from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents as money } from "~/lib/format";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { FinancialDialogLoading } from "~/features/financial-treatments/financial-dialog-loading";
import { ContractTerminationDialog } from "./contract-termination-dialog";
import { ContractRenegotiationMode } from "./contract-renegotiation-mode";
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
  if (mode === "terminate")
    return (
      <ContractTerminationDialog
        contractId={contractId}
        onClose={onClose}
        onReduce={() => setMode("reduce")}
      />
    );
  return (
    <ReductionDialog
      contractId={contractId}
      onClose={onClose}
      onTerminate={() => setMode("terminate")}
    />
  );
}

function ReductionDialog({
  contractId,
  onClose,
  onTerminate,
}: {
  contractId: string;
  onClose: () => void;
  onTerminate: () => void;
}): ReactElement {
  const options = trpc.finance.renegotiationOptions.useQuery(
    { contractId },
    { retry: false, refetchOnWindowFocus: false },
  );
  if (options.data)
    return <ReductionForm options={options.data} onClose={onClose} onTerminate={onTerminate} />;
  return (
    <TaskDialog
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
}: {
  options: RenegotiationOptions;
  onClose: () => void;
  onTerminate: () => void;
}): ReactElement {
  const utils = trpc.useUtils();
  const validation = useValidation();
  const [ids, setIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<RenegotiationPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const save = trpc.finance.confirmRenegotiation.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      onClose();
    },
  });
  const pending = loading || save.isPending;
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      if (confirmed) save.mutate(confirmed);
      return;
    }
    setLoading(true);
    try {
      const { reason: _reason, ...request } = values;
      setReview(await utils.finance.previewRenegotiation.fetch(request));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível preparar a renegociação.",
      );
    } finally {
      setLoading(false);
    }
  }
  function back(): void {
    setReview(null);
    setAcknowledged(false);
    setError(undefined);
    save.reset();
    setCommandId(crypto.randomUUID());
    requestAnimationFrame(() => document.getElementById("renegotiation-amount")?.focus());
  }
  return (
    <TaskDialog
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
      <form
        id="contract-renegotiation"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-3"
      >
        <Alert className="py-2 text-caption">
          <strong>Medida excepcional, de último recurso.</strong>
          <p>
            Use quando as condições habituais não forem suficientes para manter o contrato. A
            redução pode ficar abaixo da faixa de descontos autorizada.
          </p>
        </Alert>
        <fieldset disabled={pending} className="grid gap-3">
          {review ? (
            <>
              <RenegotiationReview preview={review} reason={reason} />
              <label className="flex items-start gap-2 rounded-sm border p-2.5 text-caption">
                <Checkbox checked={acknowledged} onCheckedChange={setAcknowledged} />
                <span>
                  Conferi as {review.lines.length} parcelas e autorizo a redução total de{" "}
                  {money(review.reductionCents)}.
                </span>
              </label>
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
        {(error ?? save.error?.message) && (
          <Alert variant="destructive">{error ?? save.error?.message}</Alert>
        )}
        {save.error && (
          <Button size="sm" type="button" variant="secondary" onClick={back}>
            <RefreshCw aria-hidden /> Atualizar prévia
          </Button>
        )}
        <RenegotiationHistory history={options.history} />
      </form>
    </TaskDialog>
  );
}
