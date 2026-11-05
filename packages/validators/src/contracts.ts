import { z } from "zod";

import { civilDateSchema } from "./civil-date.js";
import { payerCreateInputSchema } from "./finance.js";
import { studentCreateInputSchema } from "./student.js";

const MAX_PERCENT = 100;
const PERCENT_DECIMAL_PLACES = 4;
const MAX_DURATION_MONTHS = 120;
const MAX_MONTHLY_AMOUNT_CENTS = 1_000_000_000;
const MAX_PERSISTED_AMOUNT_CENTS = 2_147_483_647;
const MAX_SEARCH_LENGTH = 80;
const MAX_AGREEMENT_LENGTH = 5000;

const percentage = z
  .number()
  .finite()
  .min(0)
  .max(MAX_PERCENT)
  .refine((value) => Number(value.toFixed(PERCENT_DECIMAL_PLACES)) === value);

const scholarshipPercentage = z
  .number({ invalid_type_error: "Informe um percentual válido para a bolsa." })
  .min(0, "O percentual da bolsa deve ser entre 0 e 100.")
  .max(MAX_PERCENT, "O percentual da bolsa deve ser entre 0 e 100.")
  .refine((value) => Number(value.toFixed(PERCENT_DECIMAL_PLACES)) === value, {
    message: "Use até quatro casas decimais no percentual da bolsa.",
  });

const newContractPayerSchema = payerCreateInputSchema;

export const contractMaterialInputSchema = z
  .object({
    stageIds: z.array(z.string().uuid()).min(1, "Selecione pelo menos um livro."),
    category: z.enum(["CHILD", "ADULT"]),
    scholarshipPct: scholarshipPercentage.optional(),
    scholarshipAgreement: z
      .string()
      .trim()
      .max(MAX_AGREEMENT_LENGTH, "Use até 5.000 caracteres.")
      .nullish(),
    payment: z.enum(["INSTALLMENTS", "CASH"]),
    installmentCount: z
      .number()
      .int("Informe um número inteiro de parcelas.")
      .min(1, "Informe pelo menos uma parcela.")
      .max(MAX_PERSISTED_AMOUNT_CENTS),
    quoteVersion: z.string().regex(/^[a-f0-9]{64}$/u),
    expectedTotalCents: z.number().int().nonnegative().max(MAX_PERSISTED_AMOUNT_CENTS),
    priceOverrideCents: z
      .number()
      .int()
      .min(1, "Informe um valor maior que zero.")
      .max(MAX_PERSISTED_AMOUNT_CENTS)
      .optional(),
  })
  .strict()
  .refine((value) => new Set(value.stageIds).size === value.stageIds.length, {
    path: ["stageIds"],
    message: "Selecione livros de estágios diferentes.",
  })
  .refine(
    (input) =>
      input.payment === "CASH" || input.scholarshipPct === MAX_PERCENT
        ? input.installmentCount === 1
        : true,
    {
      path: ["installmentCount"],
      message: "O pagamento à vista ou sem cobrança deve ser registrado em uma vez.",
    },
  )
  .superRefine((input, context) => {
    if ((input.scholarshipPct ?? 0) > 0 && !input.scholarshipAgreement?.trim())
      context.addIssue({
        code: "custom",
        path: ["scholarshipAgreement"],
        message: "Descreva o acordo da bolsa de material.",
      });
    if (!(input.scholarshipPct ?? 0) && input.scholarshipAgreement?.trim())
      context.addIssue({
        code: "custom",
        path: ["scholarshipPct"],
        message: "Informe o percentual da bolsa de material.",
      });
  });

export const addContractMaterialInputSchema = z
  .object({
    commandId: z.string().uuid(),
    contractId: z.string().uuid(),
    firstDueDate: civilDateSchema,
    material: contractMaterialInputSchema,
  })
  .strict();

export type ContractMaterialInput = z.infer<typeof contractMaterialInputSchema>;
export type AddContractMaterialInput = z.infer<typeof addContractMaterialInputSchema>;

export const createMonthlyContractInputSchema = z
  .object({
    commandId: z.string().uuid(),
    renewedFromId: z.string().uuid().optional(),
    material: contractMaterialInputSchema.optional(),
    studentId: z.string().uuid().optional(),
    payerId: z.string().uuid().optional(),
    agreedOn: civilDateSchema,
    startsOn: civilDateSchema,
    durationMonths: z.number().int().min(1).max(MAX_DURATION_MONTHS),
    installmentCount: z.number().int().positive().optional(),
    firstDueDate: civilDateSchema,
    monthlyAmountCents: z.number().int().positive().max(MAX_MONTHLY_AMOUNT_CENTS),
    enrollmentFeeCents: z.number().int().nonnegative().max(MAX_PERSISTED_AMOUNT_CENTS).optional(),
    punctualityDiscountPct: percentage.optional(),
    scholarshipPct: scholarshipPercentage.optional(),
    scholarshipAgreement: z
      .string()
      .trim()
      .max(MAX_AGREEMENT_LENGTH, "Use até 5.000 caracteres.")
      .nullish(),
    newPayer: newContractPayerSchema.optional(),
    newStudent: studentCreateInputSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.scholarshipPct ?? 0) > 0 && !input.scholarshipAgreement?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["scholarshipAgreement"],
        message: "Descreva o acordo da bolsa.",
      });
    }
    if (!(input.scholarshipPct ?? 0) && input.scholarshipAgreement?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["scholarshipPct"],
        message: "Informe o percentual da bolsa.",
      });
    }
  })
  .superRefine((input, context) => {
    if (input.durationMonths * input.monthlyAmountCents > MAX_PERSISTED_AMOUNT_CENTS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyAmountCents"],
        message: "O total do contrato ultrapassa o limite permitido.",
      });
    }
    if (!input.renewedFromId && !input.material) {
      context.addIssue({
        code: "custom",
        path: ["material", "stageIds"],
        message: "Inclua o material para criar um novo contrato.",
      });
    }
    if (input.renewedFromId && (input.enrollmentFeeCents ?? 0) > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enrollmentFeeCents"],
        message: "A rematrícula é gratuita.",
      });
    }
    if (input.installmentCount !== undefined && input.installmentCount > input.durationMonths) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installmentCount"],
        message: "A quantidade de parcelas não pode ultrapassar a duração do contrato em meses.",
      });
    }
  })
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
    payerId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    startsFrom: civilDateSchema.optional(),
    endsTo: civilDateSchema.optional(),
    status: z.enum(["INADIMPLENTE", "EM_DIA", "QUITADO", "SEM_SALDO", "CANCELADO"]).optional(),
  })
  .strict();

export const contractPartySearchInputSchema = z
  .object({
    query: z.string().trim().max(MAX_SEARCH_LENGTH),
  })
  .strict();

export type CreateMonthlyContractInput = z.infer<typeof createMonthlyContractInputSchema>;
