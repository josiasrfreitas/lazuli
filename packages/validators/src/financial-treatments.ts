import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";

export const financialTreatmentInstallmentsSchema = z.union([
  z.object({ studentId: z.string().uuid() }).strict(),
  z.object({ installmentIds: z.array(z.string().uuid()).min(1).max(100) }).strict(),
]);
export type FinancialTreatmentInstallments = z.infer<typeof financialTreatmentInstallmentsSchema>;

const treatmentFields = {
  studentId: z.string().uuid().optional(),
  rows: z
    .array(
      z
        .object({
          installmentId: z.string().uuid(),
          reductionCents: z.number().int().nonnegative().default(0),
          forgiveCharges: z.boolean().default(false),
        })
        .strict(),
    )
    .min(1, "Selecione ao menos uma parcela.")
    .max(100),
  newDueDate: civilDateSchema.optional(),
};
export const financialTreatmentPreviewSchema = z
  .object(treatmentFields)
  .strict()
  .refine(
    (value) => new Set(value.rows.map((row) => row.installmentId)).size === value.rows.length,
    "Parcela repetida.",
  );
export const financialTreatmentConfirmSchema = z
  .object({
    ...treatmentFields,
    commandId: z.string().uuid(),
    reason: z.string().trim().min(3, "Informe o motivo da tratativa.").max(2000),
    version: z.string().min(1),
  })
  .strict();
export type FinancialTreatmentPreview = z.infer<typeof financialTreatmentPreviewSchema>;
export type FinancialTreatmentConfirm = z.infer<typeof financialTreatmentConfirmSchema>;
