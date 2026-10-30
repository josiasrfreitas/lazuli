import { priceAfterDiscountCents } from "./monthly-contract.js";

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

/** The buyer's installments divide the acquisition total, independently of the book price. */
export function materialInstallmentPlan(
  totalCents: number,
  installmentCount: number,
): {
  installmentCount: number;
  installmentCents: number;
  lastInstallmentCents: number;
} {
  if (
    !Number.isInteger(totalCents) ||
    totalCents < 0 ||
    totalCents > MAX_CENTS ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > Math.max(1, totalCents)
  ) {
    throw new Error(
      "Informe uma quantidade de parcelas que mantenha pelo menos R$ 0,01 por parcela.",
    );
  }
  const installmentCents = Math.floor(totalCents / installmentCount);
  return {
    installmentCount,
    installmentCents,
    lastInstallmentCents: totalCents - installmentCents * (installmentCount - 1),
  };
}

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

/** Apply the scholarship before card fees; cash keeps its own quoted base. */
export function materialScholarshipQuote(input: {
  quote: MaterialQuote;
  payment: "CASH" | "INSTALLMENTS";
  scholarshipPct: number;
  cardFeePct: number;
  priceOverrideCents?: number | undefined;
}): { chargedCents: number; receivableCents: number; feeCents: number; installmentCents: number } {
  const { quote, payment, scholarshipPct, cardFeePct, priceOverrideCents } = input;
  if (priceOverrideCents !== undefined && !validPriceOverride(priceOverrideCents))
    throw new Error("Informe um valor de material maior que zero.");
  if (!Number.isFinite(scholarshipPct) || scholarshipPct < 0 || scholarshipPct > PERCENT_BASE)
    throw new Error("Informe um percentual de bolsa entre 0 e 100.");
  const installmentCents = priceAfterDiscountCents(quote.installmentCents, scholarshipPct);
  const chargedCents = materialChargedCents(input, installmentCents);
  const receivableCents =
    payment === "CASH" ? chargedCents : priceAfterDiscountCents(chargedCents, cardFeePct);
  if (scholarshipPct < PERCENT_BASE && (chargedCents < 1 || receivableCents < 1))
    throw new Error("A bolsa parcial deve manter um valor de pelo menos um centavo.");
  return {
    chargedCents,
    receivableCents,
    feeCents: chargedCents - receivableCents,
    installmentCents,
  };
}

function validPriceOverride(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_CENTS;
}

function materialChargedCents(
  input: Parameters<typeof materialScholarshipQuote>[0],
  installmentCents: number,
): number {
  if (input.priceOverrideCents !== undefined)
    return priceAfterDiscountCents(input.priceOverrideCents, input.scholarshipPct);
  if (input.payment === "CASH")
    return priceAfterDiscountCents(input.quote.cashCents, input.scholarshipPct);
  return installmentCents * input.quote.installments;
}
