"use client";

import type { FormEvent, JSX as ReactJSX } from "react";
import { ArrowRight, RefreshCw, X } from "lucide-react";
import { Button } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";
import { TerminationView } from "./contract-termination-view";
import {
  terminationAmounts,
  useTerminationState,
  validateTermination,
  type TerminationPreview,
} from "./contract-termination-state";

export function ContractTerminationDialog({
  contractId,
  onClose,
}: {
  contractId: string;
  onClose: () => void;
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
}: {
  pending: boolean;
  error: string | undefined;
  onClose: () => void;
  onRetry: () => void;
}): ReactJSX.Element {
  return (
    <TaskDialog
      title="Rescindir contrato e encerrar matrícula"
      description="Confira o acerto antes de confirmar."
      onClose={onClose}
      pending={false}
      formId="termination-loading"
      firstField=""
      submitLabel="Revisar rescisão"
      submitIcon={<ArrowRight aria-hidden="true" />}
      cancelIcon={<X aria-hidden="true" />}
      submitDisabled
      error={error}
    >
      {pending ? (
        <p className="text-sm text-muted-foreground">Calculando valores em aberto…</p>
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
}: {
  preview: TerminationPreview;
  onClose: () => void;
  onRefresh: () => void;
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
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
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
    mutation.mutate(validation.input);
  };
  return (
    <TerminationView
      preview={preview}
      state={state}
      amounts={amounts}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={handleSubmit}
      onReset={mutation.reset}
      pending={mutation.isPending}
      mutationError={mutation.error?.message}
    />
  );
}
