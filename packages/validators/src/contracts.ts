import { z } from "zod";

import { civilDateSchema } from "./civil-date.js";
import { payerCreateInputSchema } from "./finance.js";
import {
  studentCreateInputSchema,
  documentTypeSchema,
  DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
} from "./student.js";

const MAX_PERCENT = 100;
const PERCENT_DECIMAL_PLACES = 4;
const MAX_DURATION_MONTHS = 120;
const MAX_MONTHLY_AMOUNT_CENTS = 1_000_000_000;
const MAX_SEARCH_LENGTH = 80;

const percentage = z
  .number()
  .finite()
  .min(0)
  .max(MAX_PERCENT)
  .refine((value) => Number(value.toFixed(PERCENT_DECIMAL_PLACES)) === value);

const newContractPayerSchema = payerCreateInputSchema
  .omit({ taxId: true })
  .extend({
    documentType: documentTypeSchema.nullish(),
    documentNumber: z.string().trim().min(1, "Informe o número do documento.").nullish(),
  })
  .refine((payer) => !payer.documentNumber || Boolean(payer.documentType), {
    path: ["documentType"],
    message: DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
  });

export const createMonthlyContractInputSchema = z
  .object({
    commandId: z.string().uuid(),
    studentId: z.string().uuid().optional(),
    payerId: z.string().uuid().optional(),
    agreedOn: civilDateSchema,
    startsOn: civilDateSchema,
    durationMonths: z.number().int().min(1).max(MAX_DURATION_MONTHS),
    firstDueDate: civilDateSchema,
    monthlyAmountCents: z.number().int().positive().max(MAX_MONTHLY_AMOUNT_CENTS),
    punctualityDiscountPct: percentage.optional(),
    newPayer: newContractPayerSchema.optional(),
    newStudent: studentCreateInputSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.studentId === undefined) === (input.newStudent === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "Selecione um aluno existente ou cadastre um novo.",
      });
    }
    if ((input.payerId === undefined) === (input.newPayer === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payerId"],
        message: "Selecione um pagador existente ou cadastre um novo.",
      });
    }
  });

export const listContractsInputSchema = z
  .object({
    page: z.number().int().positive().default(1),
    query: z.string().trim().max(MAX_SEARCH_LENGTH).default(""),
  })
  .strict();

export const contractPartySearchInputSchema = z
  .object({
    query: z.string().trim().max(MAX_SEARCH_LENGTH),
  })
  .strict();

export type CreateMonthlyContractInput = z.infer<typeof createMonthlyContractInputSchema>;
