"use client";

import type { ReactElement } from "react";
import { FileUpload } from "@lazuli/ui";
import {
  MAX_PAYMENT_PROOF_BYTES,
  PAYMENT_PROOF_ACCEPT,
  type PaymentProofUpload,
} from "@lazuli/validators";

export type PaymentProofDraft = { id: string; file: File | undefined; error: string };
export type PaymentProofDrafts = Record<string, PaymentProofDraft | undefined>;

export function PaymentProofPicker({
  label = "Comprovante de pagamento",
  description,
  value,
  disabled,
  onChange,
  onError,
}: {
  label?: string;
  description?: string | undefined;
  value: PaymentProofDraft | undefined;
  disabled: boolean;
  onChange: (file: File | undefined) => void;
  onError: (message: string) => void;
}): ReactElement {
  return (
    <div className="grid gap-2 border-t border-border px-3 py-3">
      <p className="text-caption font-medium">
        {label} <span className="font-normal text-muted-foreground">· opcional</span>
      </p>
      {description && <p className="text-caption text-muted-foreground">{description}</p>}
      <FileUpload
        compact
        layout="inline"
        value={value?.file ? [value.file] : []}
        onValueChange={(files) => onChange(files[0])}
        onValidationError={onError}
        accept={PAYMENT_PROOF_ACCEPT}
        acceptLabel="PDF, JPG ou PNG"
        maxSize={MAX_PAYMENT_PROOF_BYTES}
        disabled={disabled}
      />
    </div>
  );
}

export async function uploadPaymentProof(input: {
  id: string;
  paymentEntryId: string;
  file: File;
}): Promise<void> {
  const metadata: PaymentProofUpload = {
    id: input.id,
    paymentEntryId: input.paymentEntryId,
    fileName: input.file.name,
    contentType: input.file.type as PaymentProofUpload["contentType"],
    byteLength: input.file.size,
  };
  const response = await fetch("/api/payment-proofs", {
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
