import { z } from "zod";

import { civilDateSchema } from "./civil-date.js";

const percentage = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .refine((value) => Number(value.toFixed(4)) === value);

export const createMonthlyContractInputSchema = z
  .object({
    commandId: z.string().uuid(),
    studentId: z.string().uuid(),
    payerId: z.string().uuid(),
    agreedOn: civilDateSchema,
    startsOn: civilDateSchema,
    durationMonths: z.number().int().min(1).max(120),
    firstDueDate: civilDateSchema,
    monthlyAmountCents: z.number().int().positive().max(1_000_000_000),
    punctualityDiscountPct: percentage,
  })
  .strict();

export const listContractsInputSchema = z
  .object({
    page: z.number().int().positive().default(1),
  })
  .strict();

export const contractPartySearchInputSchema = z
  .object({
    query: z.string().trim().max(80),
  })
  .strict();

export type CreateMonthlyContractInput = z.infer<typeof createMonthlyContractInputSchema>;
