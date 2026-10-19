export const INITIAL_MATERIAL_PRICING = {
  childMaterialInstallments: 6,
  childMaterialInstallmentCents: 12_300,
  adultMaterialInstallments: 6,
  adultMaterialInstallmentCents: 13_600,
  materialCardFeePct: 10,
} as const;

const PERCENT_PRECISION = 10_000;
const FULL_PERCENT = 100 * PERCENT_PRECISION;
const MAX_CENTS = 2_147_483_647;

/** The agreed card total includes the global fee; the school receives the cash price once. */
export function materialPriceQuote(
  installments: number,
  installmentCents: number,
  cardFeePct: number,
) {
  const totalCents = installments * installmentCents;
  const feeUnits = Math.round(cardFeePct * PERCENT_PRECISION);
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > MAX_CENTS ||
    !Number.isInteger(installmentCents) ||
    installmentCents < 0 ||
    !Number.isSafeInteger(totalCents) ||
    totalCents > MAX_CENTS ||
    !Number.isFinite(cardFeePct) ||
    cardFeePct < 0 ||
    cardFeePct > 100 ||
    Math.abs(feeUnits / PERCENT_PRECISION - cardFeePct) > Number.EPSILON
  ) {
    throw new Error("Invalid material pricing terms");
  }
  const numerator = BigInt(totalCents) * BigInt(FULL_PERCENT - feeUnits);
  const cashCents = Number((numerator + BigInt(FULL_PERCENT / 2)) / BigInt(FULL_PERCENT));
  return { installments, installmentCents, totalCents, cashCents };
}
