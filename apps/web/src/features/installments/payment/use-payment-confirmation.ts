"use client";

import { useRef, useState, type RefObject } from "react";
import type { PaymentOperationInput } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { uploadPaymentProof, type PaymentProofDrafts } from "./payment-proof";

type PendingProof = { id: string; file: File; paymentEntryId: string };
type Attempt = { command: PaymentOperationInput; proofs: PaymentProofDrafts };
type PaymentConfirmation = {
  locked: boolean;
  submitting: boolean;
  uploading: boolean;
  registered: boolean;
  uncertain: boolean;
  error: string | null;
  isSubmitting: () => boolean;
  clearError: () => void;
  finish: () => void;
  send: (command: PaymentOperationInput, selectedProofs: PaymentProofDrafts) => void;
};

export function usePaymentConfirmation(onRegistered: () => void): PaymentConfirmation {
  const pending = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const proofs = useRef<PendingProof[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const finish = createPaymentFinish(trpc.useUtils(), onRegistered);

  const sendProofs = createProofSender({ proofs, pending, setUploadError, setUploading, finish });

  const mutation = trpc.finance.confirmPayments.useMutation({
    onSuccess: async (result, command) => {
      setRegistered(true);
      setUncertain(false);
      proofs.current = pendingPaymentProofs({ result, command, attempt: attempt.current });
      await sendProofs();
    },
    onError: (error) => {
      pending.current = false;
      const rejected = ["BAD_REQUEST", "CONFLICT", "FORBIDDEN"].includes(error.data?.code ?? "");
      if (rejected) attempt.current = null;
      setUncertain(!rejected);
    },
  });

  return {
    locked: mutation.isPending || uncertain || registered,
    submitting: mutation.isPending || uploading,
    uploading,
    registered,
    uncertain,
    error: paymentConfirmationError({
      uploadError,
      uncertain,
      mutationError: mutation.error?.message,
    }),
    isSubmitting: () => pending.current,
    clearError: () => mutation.reset(),
    finish,
    send: (command: PaymentOperationInput, selectedProofs: PaymentProofDrafts) => {
      if (pending.current) return;
      pending.current = true;
      if (registered) {
        void sendProofs();
        return;
      }
      attempt.current ??= { command, proofs: selectedProofs };
      mutation.mutate(attempt.current.command);
    },
  };
}

function createPaymentFinish(
  utils: ReturnType<typeof trpc.useUtils>,
  onRegistered: () => void,
): () => void {
  return () => {
    void utils.finance.invalidate();
    void utils.activity.invalidate();
    onRegistered();
  };
}

function paymentConfirmationError({
  uploadError,
  uncertain,
  mutationError,
}: {
  uploadError: string | null;
  uncertain: boolean;
  mutationError: string | undefined;
}): string | null {
  return (
    uploadError ??
    (uncertain
      ? "Não foi possível confirmar o resultado. Verifique o registro antes de alterar o recebimento."
      : (mutationError ?? null))
  );
}

function pendingPaymentProofs({
  result,
  command,
  attempt,
}: {
  result: { id: string }[];
  command: PaymentOperationInput;
  attempt: Attempt | null;
}): PendingProof[] {
  return result.flatMap((payment, index) => {
    const receipt = command.receipts[index];
    const proof = receipt && attempt?.proofs[receipt.commandId];
    return proof?.file ? [{ id: proof.id, file: proof.file, paymentEntryId: payment.id }] : [];
  });
}

function createProofSender({
  proofs,
  pending,
  setUploadError,
  setUploading,
  finish,
}: {
  proofs: RefObject<PendingProof[]>;
  pending: RefObject<boolean>;
  setUploadError: (error: string | null) => void;
  setUploading: (uploading: boolean) => void;
  finish: () => void;
}): () => Promise<void> {
  return async () => {
    setUploadError(null);
    setUploading(proofs.current.length > 0);
    try {
      while (proofs.current[0]) {
        await uploadPaymentProof(proofs.current[0]);
        proofs.current.shift();
      }
      finish();
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "O envio foi interrompido.";
      setUploadError(
        `Pagamento registrado. ${message} O arquivo continua selecionado; reenviar não registra outro pagamento.`,
      );
    } finally {
      pending.current = false;
      setUploading(false);
    }
  };
}
