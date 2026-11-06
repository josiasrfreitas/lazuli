import { z } from "zod";

const MAX_FILE_NAME_LENGTH = 200;
export const MAX_PAYMENT_PROOF_BYTES = 5_242_880;
export const PAYMENT_PROOF_ACCEPT = "application/pdf,image/jpeg,image/png";

export const paymentProofUploadSchema = z
  .object({
    id: z.string().uuid(),
    paymentEntryId: z.string().uuid(),
    fileName: z.string().trim().min(1).max(MAX_FILE_NAME_LENGTH),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    byteLength: z.number().int().positive().max(MAX_PAYMENT_PROOF_BYTES),
  })
  .strict();

export type PaymentProofUpload = z.infer<typeof paymentProofUploadSchema>;

export const paymentReversalProofUploadSchema = paymentProofUploadSchema
  .omit({ paymentEntryId: true })
  .extend({ paymentReversalId: z.string().uuid() })
  .strict();

export type PaymentReversalProofUpload = z.infer<typeof paymentReversalProofUploadSchema>;
