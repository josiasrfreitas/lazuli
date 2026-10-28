"use client";
import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import type { FinanceInstallmentRow, PaymentOperationInput } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { businessDate } from "../view-model";
import { usePaymentConfirmation } from "./use-payment-confirmation";
import type { PaymentProofDrafts } from "./payment-proof";
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
  methods: RouterOutputs["finance"]["paymentMethods"];
  methodsLoading: boolean;
  methodsError: boolean;
  draft: PaymentDraft;
  dispatch: Dispatch<DraftAction>;
  preview: PreviewRow[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  uncertain: boolean;
  registered: boolean;
  uploading: boolean;
  proofs: PaymentProofDrafts;
  setProof: (receiptId: string, file: File | undefined) => void;
  setProofError: (receiptId: string, message: string) => void;
  finish: () => void;
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
  const [proofs, setProofs] = useState<PaymentProofDrafts>({});
  const query = usePaymentPreview(draft);
  const methods = trpc.finance.paymentMethods.useQuery();
  const confirmation = usePaymentConfirmation(input.onRegistered);
  useIncomingRows({ rows: input.rows, dispatch, locked: confirmation.locked });
  const change: Dispatch<DraftAction> = (action) => {
    if (confirmation.locked) return;
    setError(null);
    dispatch(action);
  };
  const submit = (): void => {
    if (confirmation.isSubmitting()) return;
    const methodError = methods.data?.some((method) => method.code === draft.method)
      ? null
      : "Selecione uma forma de pagamento disponível.";
    const proofError = draft.items.map((item) => proofs[item.receiptId]?.error).find(Boolean);
    const problem =
      confirmation.uncertain || confirmation.registered
        ? null
        : proofError || methodError || paymentDraftError(draft, query.data ?? []);
    if (
      problem ||
      (!confirmation.uncertain && !confirmation.registered && (query.isFetching || query.isError))
    ) {
      setError(problem ?? "Aguarde o cálculo da prévia.");
      setRevision((value) => value + 1);
      return;
    }
    confirmation.send(buildCommand(draft, query.data ?? []), proofs);
  };
  return {
    methods: methods.data ?? [],
    methodsLoading: methods.isPending,
    methodsError: methods.isError,
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
    registered: confirmation.registered,
    uploading: confirmation.uploading,
    proofs,
    setProof: (receiptId, file) => {
      if (confirmation.locked) return;
      setError(null);
      setProofs((current) => ({
        ...current,
        [receiptId]: { id: crypto.randomUUID(), file, error: "" },
      }));
    },
    setProofError: (receiptId, message) => {
      if (confirmation.locked) return;
      setProofs((current) => ({
        ...current,
        [receiptId]: {
          id: current[receiptId]?.id ?? crypto.randomUUID(),
          file: current[receiptId]?.file,
          error: message,
        },
      }));
    },
    finish: confirmation.finish,
    revision,
    submit,
    isSubmitting: confirmation.isSubmitting,
    refresh: () => {
      setError(null);
      confirmation.clearError();
      void query.refetch();
      void methods.refetch();
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
