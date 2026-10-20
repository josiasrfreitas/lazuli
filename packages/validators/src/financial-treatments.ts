import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";

export const FINANCIAL_TREATMENT_PAGE_SIZE = 50;
const MAX_SELECTION = 100;
const MAX_CURSOR = 100_000;
const MIN_REASON = 3;
const MAX_REASON = 2000;
export const financialTreatmentInstallmentsSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    installmentIds: z.array(z.string().uuid()).min(1).max(MAX_SELECTION).optional(),
    direction: z.literal("forward").optional(),
    cursor: z.number().int().min(1).max(MAX_CURSOR).nullish(),
  })
  .strict()
  .refine(
    (value) => value.studentId !== undefined || value.installmentIds !== undefined,
    "Informe o aluno ou as parcelas.",
  );
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
    .max(MAX_SELECTION),
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
    reason: z.string().trim().min(MIN_REASON, "Informe o motivo da tratativa.").max(MAX_REASON),
    version: z.string().min(1),
  })
  .strict();
export type FinancialTreatmentPreview = z.infer<typeof financialTreatmentPreviewSchema>;
export type FinancialTreatmentConfirm = z.infer<typeof financialTreatmentConfirmSchema>;
