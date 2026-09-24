export type MonthlyContractTerms = {
  startsOn: string;
  durationMonths: number;
  firstDueDate: string;
  monthlyAmountCents: number;
  tuitionCeilingCents: number;
  maximumDiscountPct: number;
  punctualityDiscountPct: number;
};

const PERCENT_UNITS = 1_000_000;

export function addCalendarMonths(value: string, months: number): string {
  const sourceYear = Number(value.slice(0, 4));
  const sourceMonth = Number(value.slice(5, 7));
  const sourceDay = Number(value.slice(8, 10));
  const monthIndex = sourceYear * 12 + sourceMonth - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(sourceDay, lastDay)).padStart(2, "0")}`;
}

/** Percentages have at most four decimal places. Integer units avoid float-cent drift. */
export function priceAfterDiscountCents(amountCents: number, discountPct: number): number {
  const discountUnits = BigInt(Math.round(discountPct * 10_000));
  const numerator = BigInt(amountCents) * (BigInt(PERCENT_UNITS) - discountUnits);
  return Number((numerator + BigInt(PERCENT_UNITS / 2)) / BigInt(PERCENT_UNITS));
}

export function previewMonthlyContract(terms: MonthlyContractTerms): {
  endsOn: string;
  principalAmountCents: number;
  onTimeMonthlyCents: number;
  floorCents: number;
  installments: Array<{ sequenceNumber: number; amountCents: number; dueDate: string }>;
} {
  const principalAmountCents = terms.durationMonths * terms.monthlyAmountCents;
  const numerator =
    BigInt(terms.tuitionCeilingCents) *
    BigInt(PERCENT_UNITS - Math.round(terms.maximumDiscountPct * 10_000));
  const floorCents = Number((numerator + BigInt(PERCENT_UNITS - 1)) / BigInt(PERCENT_UNITS));
  const onTimeMonthlyCents = priceAfterDiscountCents(
    terms.monthlyAmountCents,
    terms.punctualityDiscountPct,
  );
  if (terms.monthlyAmountCents > terms.tuitionCeilingCents || onTimeMonthlyCents < floorCents) {
    throw new Error("Mensalidade e pontualidade fora da faixa autorizada.");
  }
  return {
    endsOn: addCalendarMonths(terms.startsOn, terms.durationMonths),
    principalAmountCents,
    onTimeMonthlyCents,
    floorCents,
    installments: Array.from({ length: terms.durationMonths }, (_, index) => ({
      sequenceNumber: index + 1,
      amountCents: terms.monthlyAmountCents,
      dueDate: addCalendarMonths(terms.firstDueDate, index),
    })),
  };
}
