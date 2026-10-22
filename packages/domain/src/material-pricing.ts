export const INITIAL_MATERIAL_PRICING = {
  childMaterialInstallments: 6,
  childMaterialInstallmentCents: 12_300,
  adultMaterialInstallments: 6,
  adultMaterialInstallmentCents: 13_600,
  materialCardFeePct: 10,
} as const;

const PERCENT_PRECISION = 10_000;
const PERCENT_BASE = 100;
const FULL_PERCENT = PERCENT_BASE * PERCENT_PRECISION;
const MAX_CENTS = 2_147_483_647;
type MaterialTerms = { installments: number; installmentCents: number; cardFeePct: number };
type MaterialQuote = {
  installments: number;
  installmentCents: number;
  totalCents: number;
  cashCents: number;
};

/** The agreed card total includes the global fee; the school receives the cash price once. */
export function materialPriceQuote({
  installments,
  installmentCents,
  cardFeePct,
}: MaterialTerms): MaterialQuote {
  const totalCents = installments * installmentCents;
  const feeUnits = Math.round(cardFeePct * PERCENT_PRECISION);
  if (
    !validAmounts({ installments, installmentCents, totalCents }) ||
    !validFee(cardFeePct, feeUnits)
  ) {
    throw new Error("Invalid material pricing terms");
  }
  const numerator = BigInt(totalCents) * BigInt(FULL_PERCENT - feeUnits);
  const cashCents = Number((numerator + BigInt(FULL_PERCENT / 2)) / BigInt(FULL_PERCENT));
  return { installments, installmentCents, totalCents, cashCents };
}

function validAmounts(input: Omit<MaterialTerms, "cardFeePct"> & { totalCents: number }): boolean {
  return (
    Number.isInteger(input.installments) &&
    input.installments >= 1 &&
    input.installments <= MAX_CENTS &&
    Number.isInteger(input.installmentCents) &&
    input.installmentCents >= 0 &&
    Number.isSafeInteger(input.totalCents) &&
    input.totalCents <= MAX_CENTS
  );
}
function validFee(cardFeePct: number, feeUnits: number): boolean {
  return (
    Number.isFinite(cardFeePct) &&
    cardFeePct >= 0 &&
    cardFeePct <= PERCENT_BASE &&
    Math.abs(feeUnits / PERCENT_PRECISION - cardFeePct) <= Number.EPSILON
  );
}
