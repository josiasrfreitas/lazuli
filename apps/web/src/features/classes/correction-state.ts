"use client";
import { useState, type FormEvent } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { maskDateBR, parseDateBR } from "~/lib/masks";

type Preview = RouterOutputs["enrollment"]["previewCorrection"];
type Input = { actionId: string; classId: string; onClose: () => void };
export type CorrectionState = {
  date: string;
  setDate: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  error: string | null;
  preview: Preview | undefined;
  previewError: string | null;
  previewPending: boolean;
  applyPending: boolean;
  requestPreview: (event: FormEvent<HTMLFormElement>) => void;
  confirm: () => void;
};
export function useCorrectionState(input: Input): CorrectionState {
  const [date, saveDate] = useState("");
  const [reason, setReason] = useState("");
  const [previewDate, setPreviewDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = trpc.enrollment.previewCorrection.useQuery(
    { actionId: input.actionId, effectiveDate: previewDate ?? new Date(0) },
    { enabled: previewDate !== null, retry: false },
  );
  const apply = useApplyCorrection(input, setError);
  function requestPreview(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const iso = parseDateBR(date);
    if (!iso) {
      setError("Informe uma data válida.");
      return;
    }
    setError(null);
    setPreviewDate(new Date(iso));
  }
  function confirm(): void {
    if (!preview.data || !previewDate || !reason.trim()) {
      setError("Revise a prévia e informe a justificativa.");
      return;
    }
    apply.mutate({
      actionId: input.actionId,
      effectiveDate: previewDate,
      expectedVersion: preview.data.version,
      justification: reason.trim(),
    });
  }
  return {
    date,
    setDate: (value) => {
      saveDate(maskDateBR(value));
      setPreviewDate(null);
    },
    reason,
    setReason,
    error,
    preview: preview.data,
    previewError: preview.isError ? preview.error.message : null,
    previewPending: preview.isFetching,
    applyPending: apply.isPending,
    requestPreview,
    confirm,
  };
}

function useApplyCorrection(
  input: Input,
  setError: (value: string | null) => void,
): ReturnType<typeof trpc.enrollment.applyCorrection.useMutation> {
  const utils = trpc.useUtils();
  return trpc.enrollment.applyCorrection.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.classes.actions.invalidate({ id: input.classId }),
        utils.classes.roster.invalidate({ id: input.classId }),
        utils.classes.byId.invalidate({ id: input.classId }),
        utils.classes.list.invalidate(),
      ]);
      input.onClose();
    },
    onError: (cause) => setError(cause.message),
  });
}
