import { z } from "zod";

import { civilDateSchema } from "./civil-date.js";

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

export const createMonthlyContractInputSchema = z
  .object({
    commandId: z.string().uuid(),
    studentId: z.string().uuid(),
    payerId: z.string().uuid(),
    agreedOn: civilDateSchema,
    startsOn: civilDateSchema,
    durationMonths: z.number().int().min(1).max(MAX_DURATION_MONTHS),
    firstDueDate: civilDateSchema,
    monthlyAmountCents: z.number().int().positive().max(MAX_MONTHLY_AMOUNT_CENTS),
    punctualityDiscountPct: percentage,
  })
  .strict();

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
