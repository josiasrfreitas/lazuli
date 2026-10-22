import { z } from "zod";

const MAX_DATABASE_INTEGER = 2_147_483_647;

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
    // Legacy clients may still submit the previous single-price field.
    materialPriceCents: z.number().int().nonnegative().optional(),
    childMaterialInstallments: z.number().int().positive().max(MAX_DATABASE_INTEGER).optional(),
    childMaterialInstallmentCents: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_DATABASE_INTEGER)
      .optional(),
    adultMaterialInstallments: z.number().int().positive().max(MAX_DATABASE_INTEGER).optional(),
    adultMaterialInstallmentCents: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_DATABASE_INTEGER)
      .optional(),
    materialCardFeePct: percentage.optional(),
  })
  .strict()
  .superRefine((values, ctx) => {
    for (const [countKey, amountKey] of [
      ["childMaterialInstallments", "childMaterialInstallmentCents"],
      ["adultMaterialInstallments", "adultMaterialInstallmentCents"],
    ] as const) {
      const count = values[countKey];
      const amount = values[amountKey];
      if ((count === undefined) !== (amount === undefined)) {
        ctx.addIssue({
          code: "custom",
          path: [count === undefined ? countKey : amountKey],
          message: "Informe a quantidade e o valor das parcelas.",
        });
      } else if (
        count !== undefined &&
        amount !== undefined &&
        count * amount > MAX_DATABASE_INTEGER
      ) {
        ctx.addIssue({
          code: "custom",
          path: [amountKey],
          message: "O total excede o valor permitido.",
        });
      }
    }
  });

export type FinanceSettingsInput = z.infer<typeof financeSettingsInputSchema>;

/** The lowest permitted tuition, rounded toward the next whole cent. */
export function tuitionFloorCents(ceilingCents: number, discountPct: number): number {
  return Math.ceil(
    (ceilingCents * (PERCENT_SCALE - discountPct) - ROUNDING_EPSILON) / PERCENT_SCALE,
  );
}
