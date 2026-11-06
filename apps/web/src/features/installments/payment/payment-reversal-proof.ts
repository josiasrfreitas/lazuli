import type { PaymentReversalProofUpload } from "@lazuli/validators";

export async function uploadPaymentReversalProof(input: {
  id: string;
  paymentReversalId: string;
  file: File;
}): Promise<void> {
  const metadata: PaymentReversalProofUpload = {
    id: input.id,
    paymentReversalId: input.paymentReversalId,
    fileName: input.file.name,
    contentType: input.file.type as PaymentReversalProofUpload["contentType"],
    byteLength: input.file.size,
  };
  const response = await fetch("/api/payment-reversal-proofs", {
    method: "POST",
    headers: {
      "Content-Type": input.file.type,
      "X-Upload-Metadata": encodeURIComponent(JSON.stringify(metadata)),
    },
    body: input.file,
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(result?.message ?? "Não foi possível enviar o comprovante. Tente novamente.");
  }
}
