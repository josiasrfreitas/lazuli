"use client";

import { useRef, useState } from "react";
import type { PaymentOperationInput } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { uploadPaymentProof, type PaymentProofDrafts } from "./payment-proof";

type PendingProof = { id: string; file: File; paymentEntryId: string };
type Attempt = { command: PaymentOperationInput; proofs: PaymentProofDrafts };

export function usePaymentConfirmation(onRegistered: () => void) {
  const utils = trpc.useUtils();
  const pending = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const proofs = useRef<PendingProof[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  function finish(): void {
    void utils.finance.invalidate();
    void utils.activity.invalidate();
    onRegistered();
  }

  async function sendProofs(): Promise<void> {
    setUploadError(null);
    setUploading(proofs.current.length > 0);
    try {
      while (proofs.current[0]) {
        await uploadPaymentProof(proofs.current[0]);
        proofs.current.shift();
      }
      finish();
    } catch (error) {
      const message = error instanceof Error ? error.message : "O envio foi interrompido.";
      setUploadError(
        `Pagamento registrado. ${message} O arquivo continua selecionado; reenviar não registra outro pagamento.`,
      );
    } finally {
      pending.current = false;
      setUploading(false);
    }
  }

  const mutation = trpc.finance.confirmPayments.useMutation({
    onSuccess: async (result, command) => {
      setRegistered(true);
      setUncertain(false);
      proofs.current = result.flatMap((payment, index) => {
        const receipt = command.receipts[index];
        const proof = receipt && attempt.current?.proofs[receipt.commandId];
        return proof?.file ? [{ id: proof.id, file: proof.file, paymentEntryId: payment.id }] : [];
      });
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
    error:
      uploadError ??
      (uncertain
        ? "Não foi possível confirmar o resultado. Verifique o registro antes de alterar o recebimento."
        : (mutation.error?.message ?? null)),
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
