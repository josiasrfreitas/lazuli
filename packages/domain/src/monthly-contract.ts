import { splitPrincipal } from "./installment-amounts.js";

export type MonthlyContractTerms = {
  startsOn: string;
  durationMonths: number;
  installmentCount?: number | undefined;
  firstDueDate: string;
  monthlyAmountCents: number;
  tuitionCeilingCents: number;
  maximumDiscountPct: number;
  punctualityDiscountPct: number;
};

const PERCENT_UNITS = 1_000_000;
const PERCENT_TO_UNITS = 10_000;
const YEAR_END = 4;
const MONTH_START = 5;
const MONTH_END = 7;
const DAY_START = 8;
const DAY_END = 10;
const MONTHS_PER_YEAR = 12;
const ONE_BASED_MONTH = 1;

export function addCalendarMonths(value: string, months: number): string {
  const sourceYear = Number(value.slice(0, YEAR_END));
  const sourceMonth = Number(value.slice(MONTH_START, MONTH_END));
  const sourceDay = Number(value.slice(DAY_START, DAY_END));
  const monthIndex = sourceYear * MONTHS_PER_YEAR + sourceMonth - ONE_BASED_MONTH + months;
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR);
  const month = (monthIndex % MONTHS_PER_YEAR) + ONE_BASED_MONTH;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(sourceDay, lastDay)).padStart(2, "0")}`;
}

/** Percentages have at most four decimal places. Integer units avoid float-cent drift. */
export function priceAfterDiscountCents(amountCents: number, discountPct: number): number {
  const discountUnits = BigInt(Math.round(discountPct * PERCENT_TO_UNITS));
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
  const installmentCount = terms.installmentCount ?? terms.durationMonths;
  if (
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > terms.durationMonths
  ) {
    throw new Error("Informe uma quantidade inteira entre 1 e a duração do contrato em meses.");
  }
  const principalAmountCents = terms.durationMonths * terms.monthlyAmountCents;
  const numerator =
    BigInt(terms.tuitionCeilingCents) *
    BigInt(PERCENT_UNITS - Math.round(terms.maximumDiscountPct * PERCENT_TO_UNITS));
  const floorCents = Number((numerator + BigInt(PERCENT_UNITS - 1)) / BigInt(PERCENT_UNITS));
  const onTimeMonthlyCents = priceAfterDiscountCents(
    terms.monthlyAmountCents,
    terms.punctualityDiscountPct,
  );
  if (
    terms.monthlyAmountCents > terms.tuitionCeilingCents ||
    terms.monthlyAmountCents < floorCents
  ) {
    throw new Error("Mensalidade acordada fora da faixa autorizada.");
  }
  return {
    endsOn: addCalendarMonths(terms.startsOn, terms.durationMonths),
    principalAmountCents,
    onTimeMonthlyCents,
    floorCents,
    installments: splitPrincipal(principalAmountCents, installmentCount).map(
      (amountCents, index) => ({
        sequenceNumber: index + 1,
        amountCents,
        dueDate: addCalendarMonths(terms.firstDueDate, index),
      }),
    ),
  };
}
