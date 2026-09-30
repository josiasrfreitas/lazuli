"use client";
import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { FinanceInstallmentRow, PaymentOperationInput } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { businessDate } from "../view-model";
import {
  paymentDateLabel,
  draftReceipts,
  initialPaymentDraft,
  paymentDraftError,
  paymentDraftReducer,
  type DraftAction,
  type PaymentDraft,
  type PreviewRow,
} from "./draft";

export type PaymentFormState = {
  draft: PaymentDraft;
  dispatch: Dispatch<DraftAction>;
  preview: PreviewRow[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  uncertain: boolean;
  revision: number;
  submit: () => void;
  refresh: () => void;
  isSubmitting: () => boolean;
};
export function usePaymentForm(input: {
  rows: FinanceInstallmentRow[];
  onRegistered: () => void;
}): PaymentFormState {
  const [draft, dispatch] = useReducer(paymentDraftReducer, input.rows, seedDraft);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const query = usePaymentPreview(draft);
  const confirmation = usePaymentConfirmation(input.onRegistered);
  useIncomingRows({ rows: input.rows, dispatch, locked: confirmation.locked });
  const change: Dispatch<DraftAction> = (action) => {
    if (confirmation.locked) return;
    setError(null);
    dispatch(action);
  };
  const submit = (): void => {
    if (confirmation.isSubmitting()) return;
    const problem = confirmation.uncertain ? null : paymentDraftError(draft, query.data ?? []);
    if (problem || (!confirmation.uncertain && (query.isFetching || query.isError))) {
      setError(problem ?? "Aguarde o cálculo da prévia.");
      setRevision((value) => value + 1);
      return;
    }
    confirmation.send(buildCommand(draft, query.data ?? []));
  };
  return {
    draft,
    dispatch: change,
    preview: query.data ?? [],
    loading: query.isFetching,
    error:
      error ??
      confirmation.error ??
      (query.isError ? "Não foi possível calcular a prévia. Tente novamente." : null),
    submitting: confirmation.submitting,
    uncertain: confirmation.uncertain,
    revision,
    submit,
    isSubmitting: confirmation.isSubmitting,
    refresh: () => {
      setError(null);
      confirmation.clearError();
      void query.refetch();
    },
  };
}
function usePaymentPreview(draft: PaymentDraft): QueryResult<PreviewRow[]> {
  const date = parseDateBR(draft.date);
  return trpc.finance.previewPayments.useQuery(
    {
      date: date ?? "",
      items: draft.items.map((item) => ({
        installmentId: item.row.installmentId,
        ...(item.amount && item.amount > 0 ? { amountCents: item.amount } : {}),
      })),
    },
    {
      enabled: date !== null && draft.items.length > 0,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
}
type Confirmation = {
  send: (command: PaymentOperationInput) => void;
  locked: boolean;
  submitting: boolean;
  uncertain: boolean;
  error: string | null;
  isSubmitting: () => boolean;
  clearError: () => void;
};
function usePaymentConfirmation(onRegistered: () => void): Confirmation {
  const utils = trpc.useUtils();
  const pending = useRef(false);
  const attempt = useRef<PaymentOperationInput | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const mutation = trpc.finance.confirmPayments.useMutation({
    onSuccess: () => {
      pending.current = false;
      attempt.current = null;
      setUncertain(false);
      void utils.finance.invalidate();
      onRegistered();
    },
    onError: (error) => {
      pending.current = false;
      const rejected =
        error.data?.code === "BAD_REQUEST" ||
        error.data?.code === "CONFLICT" ||
        error.data?.code === "FORBIDDEN";
      if (rejected) attempt.current = null;
      setUncertain(!rejected);
    },
  });
  return {
    locked: mutation.isPending || uncertain,
    submitting: mutation.isPending,
    uncertain,
    error: uncertain
      ? "Não foi possível confirmar o resultado. Verifique o registro antes de alterar o recebimento."
      : (mutation.error?.message ?? null),
    isSubmitting: () => pending.current,
    clearError: () => mutation.reset(),
    send: (command) => {
      if (pending.current) return;
      pending.current = true;
      attempt.current ??= command;
      mutation.mutate(attempt.current);
    },
  };
}

export function usePaymentSearch(input: {
  search: string;
  page: number;
  enabled: boolean;
}): QueryResult<import("@lazuli/validators").FinanceInstallmentsOutput> {
  return trpc.finance.installments.useQuery(
    { view: "all", page: input.page, pageSize: 25, search: input.search },
    { enabled: input.enabled },
  );
}

function seedDraft(rows: FinanceInstallmentRow[]): PaymentDraft {
  return initialPaymentDraft(rows, paymentDateLabel(businessDate(new Date())));
}

function buildCommand(draft: PaymentDraft, preview: PreviewRow[]): PaymentOperationInput {
  return {
    operationId: crypto.randomUUID(),
    date: parseDateBR(draft.date) ?? "",
    method: draft.method,
    receipts: draftReceipts(draft, preview),
  };
}

function useIncomingRows({
  rows,
  dispatch,
  locked,
}: {
  rows: FinanceInstallmentRow[];
  dispatch: Dispatch<DraftAction>;
  locked: boolean;
}): void {
  const imported = useRef(new Set(rows.map((row) => row.installmentId)));
  useEffect(() => {
    if (locked) return;
    for (const row of rows) {
      if (imported.current.has(row.installmentId)) continue;
      imported.current.add(row.installmentId);
      dispatch({ type: "add", row, receiptId: crypto.randomUUID() });
    }
  }, [rows, dispatch, locked]);
}
