import { tuitionFloorCents } from "@lazuli/validators";
import { formatBRLFromCents } from "~/lib/format";

const CENTS_PER_REAL = 100;
export type ContractPriceOffer = {
  tuitionCeilingCents: number;
  maximumDiscountPct: number;
  punctualityDiscountPct: number;
};

export function monthlyAmountError(
  text: string,
  offer: ContractPriceOffer | null | undefined,
): string | undefined {
  const value = text.trim();
  const amount = Math.round(Number(value.replace(",", ".")) * CENTS_PER_REAL);
  if (!/^\d+(?:[.,]\d{1,2})?$/u.test(value) || !Number.isSafeInteger(amount) || amount <= 0)
    return "Informe uma mensalidade válida.";
  if (!offer) return undefined;
  if (amount > offer.tuitionCeilingCents)
    return `A mensalidade deve ser de no máximo ${formatBRLFromCents(offer.tuitionCeilingCents)}.`;
  const floor = tuitionFloorCents(offer.tuitionCeilingCents, offer.maximumDiscountPct);
  if (amount < floor)
    return `A mensalidade acordada deve ser de pelo menos ${formatBRLFromCents(floor)}.`;
  return undefined;
}
