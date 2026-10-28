"use client";

import type { FormEvent, JSX as ReactJSX } from "react";
import { ArrowRight, RefreshCw, X } from "lucide-react";
import { Button } from "@lazuli/ui";
import { FinancialDialogLoading } from "~/features/financial-treatments/financial-dialog-loading";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { TerminationView } from "./contract-termination-view";
import { ContractRenegotiationMode } from "./contract-renegotiation-mode";
import {
  terminationAmounts,
  useTerminationState,
  validateTermination,
  type TerminationPreview,
} from "./contract-termination-state";

export function ContractTerminationDialog({
  contractId,
  onClose,
  onReduce,
}: {
  contractId: string;
  onClose: () => void;
  onReduce?: (() => void) | undefined;
}): ReactJSX.Element {
  const preview = trpc.finance.previewTermination.useQuery(
    { contractId },
    { retry: false, refetchOnWindowFocus: false },
  );
  if (preview.data)
    return (
      <TerminationForm
        key={preview.data.version}
        preview={preview.data}
        onClose={onClose}
        onReduce={onReduce}
        onRefresh={() => {
          void preview.refetch();
        }}
      />
    );
  return (
    <TerminationPreviewLoading
      pending={preview.isPending}
      error={preview.error?.message}
      onClose={onClose}
      onReduce={onReduce}
      onRetry={() => {
        void preview.refetch();
      }}
    />
  );
}

function TerminationPreviewLoading({
  pending,
  error,
  onClose,
  onRetry,
  onReduce,
}: {
  pending: boolean;
  error: string | undefined;
  onClose: () => void;
  onRetry: () => void;
  onReduce?: (() => void) | undefined;
}): ReactJSX.Element {
  return (
    <TaskDialog
      layout="termination"
      bodyLayout="termination"
      size="wide"
      compactHeader
      actionSize="sm"
      title="Renegociar contrato"
      description="Confira o acerto antes de confirmar."
      onClose={onClose}
      pending={false}
      formId="termination-loading"
      firstField="termination-fee"
      submitLabel="Revisar rescisão"
      submitIcon={<ArrowRight aria-hidden="true" />}
      cancelIcon={<X aria-hidden="true" />}
      submitDisabled
      error={error}
    >
      {onReduce && <ContractRenegotiationMode value="terminate" onChange={onReduce} />}
      {pending ? (
        <FinancialDialogLoading termination />
      ) : (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </TaskDialog>
  );
}

function TerminationForm({
  preview,
  onClose,
  onRefresh,
  onReduce,
}: {
  preview: TerminationPreview;
  onClose: () => void;
  onRefresh: () => void;
  onReduce?: (() => void) | undefined;
}): ReactJSX.Element {
  const utils = trpc.useUtils();
  const state = useTerminationState(preview);
  const mutation = trpc.finance.confirmTermination.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      onClose();
    },
  });
  const amounts = terminationAmounts(preview, state);
  return (
    <TerminationView
      preview={preview}
      state={state}
      amounts={amounts}
      onClose={onClose}
      onReduce={onReduce}
      onRefresh={onRefresh}
      onSubmit={(event) =>
        submitTermination(event, { preview, state, amounts, confirm: mutation.mutate })
      }
      onReset={mutation.reset}
      pending={mutation.isPending}
      mutationError={mutation.error?.message}
    />
  );
}

function submitTermination(
  event: FormEvent<HTMLFormElement>,
  {
    preview,
    state,
    amounts,
    confirm,
  }: {
    preview: TerminationPreview;
    state: ReturnType<typeof useTerminationState>;
    amounts: ReturnType<typeof terminationAmounts>;
    confirm: (input: NonNullable<ReturnType<typeof validateTermination>["input"]>) => void;
  },
): void {
  event.preventDefault();
  state.setError(undefined);
  state.setEnrollmentError(undefined);
  const validation = validateTermination(preview, { state, amounts });
  if (!validation.input) {
    if (validation.field === "enrollment") state.setEnrollmentError(validation.error);
    else state.setError(validation.error);
    return;
  }
  if (!state.review) {
    state.setReview(true);
    return;
  }
  confirm(validation.input);
}
