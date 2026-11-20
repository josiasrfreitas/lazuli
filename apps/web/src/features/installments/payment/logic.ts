"use client";
import { useEffect, useReducer, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { FinanceInstallmentRow, PaymentOperationInput } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { trpc, type QueryResult } from "~/lib/trpc";
import { parseDateBR } from "~/lib/masks";
import { businessDate } from "../view-model";
import { usePaymentConfirmation } from "./use-payment-confirmation";
import { withReceiptFields } from "./with-receipt-fields";
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
  attachItemProof: (item: PaymentDraft["items"][number], file: File) => void;
  finish: () => void;
  revision: number;
  submit: () => void;
  refresh: () => void;
  isSubmitting: () => boolean;
};
type PaymentFormInput = {
  rows: FinanceInstallmentRow[];
  onRegistered: () => void;
};
export function usePaymentForm(input: PaymentFormInput): PaymentFormState {
  const [manualDraft, dispatch] = useReducer(paymentDraftReducer, input.rows, seedDraft);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const methods = trpc.finance.paymentMethods.useQuery();
  const confirmation = usePaymentConfirmation(input.onRegistered);
  const proofEditor = usePaymentProofEditor(confirmation.locked, setError);
  const draft = withReceiptFields(manualDraft, proofEditor.proofs);
  const query = usePaymentPreview(draft);
  useIncomingRows({ rows: input.rows, dispatch, locked: confirmation.locked });
  const change = paymentDraftDispatch({ locked: confirmation.locked, setError, dispatch });
  const submit = createPaymentSubmit({
    draft,
    proofs: proofEditor.proofs,
    methods: methods.data ?? [],
    preview: query.data ?? [],
    previewPending: query.isFetching || query.isError,
    confirmation,
    setError,
    setRevision,
  });
  return {
    methods: methods.data ?? [],
    methodsLoading: methods.isPending,
    methodsError: methods.isError,
    draft,
    dispatch: change,
    preview: query.data ?? [],
    loading: query.isFetching,
    error: paymentFormError({
      error,
      confirmationError: confirmation.error,
      previewError: query.isError,
    }),
    submitting: confirmation.submitting,
    uncertain: confirmation.uncertain,
    registered: confirmation.registered,
    uploading: confirmation.uploading,
    proofs: proofEditor.proofs,
    setProof: proofEditor.setProof,
    setProofError: proofEditor.setProofError,
    attachItemProof: createAttachItemProof({ confirmation, proofEditor, change }),
    finish: confirmation.finish,
    revision,
    submit,
    isSubmitting: confirmation.isSubmitting,
    refresh: paymentRefresh({ setError, confirmation, query, methods }),
  };
}

function createAttachItemProof({
  confirmation,
  proofEditor,
  change,
}: {
  confirmation: ReturnType<typeof usePaymentConfirmation>;
  proofEditor: ReturnType<typeof usePaymentProofEditor>;
  change: Dispatch<DraftAction>;
}): PaymentFormState["attachItemProof"] {
  return (item, file) => {
    if (confirmation.locked) return;
    const receiptId = crypto.randomUUID();
    proofEditor.setProofError(item.receiptId, "");
    change({ type: "split", id: item.row.installmentId, receiptId });
    proofEditor.setProof(receiptId, file);
  };
}

function paymentDraftDispatch({
  locked,
  setError,
  dispatch,
}: {
  locked: boolean;
  setError: (error: string | null) => void;
  dispatch: Dispatch<DraftAction>;
}): Dispatch<DraftAction> {
  return (action) => {
    if (locked) return;
    setError(null);
    dispatch(action);
  };
}

function paymentFormError({
  error,
  confirmationError,
  previewError,
}: {
  error: string | null;
  confirmationError: string | null;
  previewError: boolean;
}): string | null {
  return (
    error ??
    confirmationError ??
    (previewError ? "Não foi possível calcular a prévia. Tente novamente." : null)
  );
}

function paymentRefresh({
  setError,
  confirmation,
  query,
  methods,
}: {
  setError: (error: string | null) => void;
  confirmation: ReturnType<typeof usePaymentConfirmation>;
  query: ReturnType<typeof usePaymentPreview>;
  methods: ReturnType<typeof trpc.finance.paymentMethods.useQuery>;
}): () => void {
  return () => {
    setError(null);
    confirmation.clearError();
    void query.refetch();
    void methods.refetch();
  };
}

function usePaymentProofEditor(
  locked: boolean,
  setError: (error: string | null) => void,
): Pick<PaymentFormState, "proofs" | "setProof" | "setProofError"> {
  const [proofs, setProofs] = useState<PaymentProofDrafts>({});
  const readers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = readers.current;
    return () => {
      for (const reader of active.values()) reader.abort();
    };
  }, []);
  return {
    proofs,
    setProof: (receiptId, file) => {
      if (locked) return;
      setError(null);
      readers.current.get(receiptId)?.abort();
      const id = crypto.randomUUID();
      setProofs((current) => ({ ...current, [receiptId]: { id, file, error: "" } }));
      if (!file) return;
      const reader = new AbortController();
      readers.current.set(receiptId, reader);
      const finish = (fields: import("./receipt-fields").ReceiptFields): void => {
        setProofs((current) => {
          const proof = current[receiptId];
          return proof?.id === id ? { ...current, [receiptId]: { ...proof, fields } } : current;
        });
      };
      const timer = window.setTimeout(() => {
        reader.abort();
        readers.current.delete(receiptId);
        finish({});
      }, 45_000);
      reader.signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
      void import("./read-receipt")
        .then((module) => module.readReceipt(file, reader.signal))
        .catch(() => ({}))
        .then((fields) => {
          if (reader.signal.aborted) return;
          readers.current.delete(receiptId);
          window.clearTimeout(timer);
          finish(fields);
        });
    },
    setProofError: (receiptId, message) => {
      if (locked) return;
      setProofs((current) => ({
        ...current,
        [receiptId]: {
          ...current[receiptId],
          id: current[receiptId]?.id ?? crypto.randomUUID(),
          file: current[receiptId]?.file,
          error: message,
        },
      }));
    },
  };
}

type PaymentSubmitParams = {
  draft: PaymentDraft;
  proofs: PaymentProofDrafts;
  methods: RouterOutputs["finance"]["paymentMethods"];
  preview: PreviewRow[];
  previewPending: boolean;
  confirmation: ReturnType<typeof usePaymentConfirmation>;
  setError: (error: string | null) => void;
  setRevision: Dispatch<SetStateAction<number>>;
};

function createPaymentSubmit(params: PaymentSubmitParams): () => void {
  const { draft, proofs, preview, previewPending, confirmation, setError, setRevision } = params;
  return () => {
    if (confirmation.isSubmitting()) return;
    const problem = paymentSubmitProblem(params);
    if (problem || (!confirmation.uncertain && !confirmation.registered && previewPending)) {
      setError(problem ?? "Aguarde o cálculo da prévia.");
      setRevision((value) => value + 1);
      return;
    }
    confirmation.send(buildCommand(draft, preview), proofs);
  };
}

function paymentSubmitProblem({
  draft,
  proofs,
  methods,
  preview,
  confirmation,
}: PaymentSubmitParams): string | null {
  if (confirmation.uncertain || confirmation.registered) return null;
  if (draft.items.some((item) => proofs[item.receiptId]?.file && !proofs[item.receiptId]?.fields))
    return "Aguarde a leitura do comprovante.";
  const methodError = methods.some((method) => method.code === draft.method)
    ? null
    : "Selecione uma forma de pagamento disponível.";
  const proofError = draft.items.map((item) => proofs[item.receiptId]?.error).find(Boolean);
  return proofError || methodError || paymentDraftError(draft, preview);
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
