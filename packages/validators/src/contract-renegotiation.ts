import { z } from "zod";

const MAX_INSTALLMENTS = 120;
const MAX_CENTS = 2_147_483_647;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 2000;

export const contractRenegotiationPreviewSchema = z
  .object({
    contractId: z.string().uuid(),
    installmentIds: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos uma parcela.")
      .max(MAX_INSTALLMENTS)
      .refine((ids) => new Set(ids).size === ids.length, "Parcela repetida."),
    newAmountCents: z.number().int().min(0).max(MAX_CENTS),
  })
  .strict();

export const contractRenegotiationConfirmSchema = contractRenegotiationPreviewSchema
  .extend({
    commandId: z.string().uuid(),
    version: z.string().min(1),
    reason: z
      .string()
      .trim()
      .min(MIN_REASON_LENGTH, "Explique o motivo da redução excepcional.")
      .max(MAX_REASON_LENGTH),
    acknowledged: z.literal(true),
  })
  .strict();

export type ContractRenegotiationPreview = z.infer<typeof contractRenegotiationPreviewSchema>;
export type ContractRenegotiationConfirm = z.infer<typeof contractRenegotiationConfirmSchema>;
