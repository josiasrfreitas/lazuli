import { z } from "zod";

const PERCENT_SCALE = 100;
const PERCENT_DECIMAL_PLACES = 4;
const ROUNDING_EPSILON = 1e-9;
const percentage = z
  .number()
  .finite()
  .min(0)
  .max(PERCENT_SCALE)
  .refine((value) => Number(value.toFixed(PERCENT_DECIMAL_PLACES)) === value, {
    message: "Use no máximo quatro casas decimais.",
  });

export const financeSettingsInputSchema = z
  .object({
    tuitionCeilingCents: z.number().int().positive(),
    maximumDiscountPct: percentage,
    punctualityDiscountPct: percentage.optional(),
    interestRatePctDaily: percentage,
    interestRatePctMonthly: percentage,
    cancellationFeePct: percentage,
    materialPriceCents: z.number().int().nonnegative(),
  })
  .strict();

export type FinanceSettingsInput = z.infer<typeof financeSettingsInputSchema>;

/** The lowest permitted tuition, rounded toward the next whole cent. */
export function tuitionFloorCents(ceilingCents: number, discountPct: number): number {
  return Math.ceil(
    (ceilingCents * (PERCENT_SCALE - discountPct) - ROUNDING_EPSILON) / PERCENT_SCALE,
  );
}
