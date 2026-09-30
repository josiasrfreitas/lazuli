import { addCalendarMonths } from "./monthly-contract.js";

const RATE_SCALE = 10_000;
const PERCENT = 100;
const ROUNDING_DIVISOR = 2n;
const DENOMINATOR = BigInt(RATE_SCALE * PERCENT);
const MILLISECONDS_PER_DAY = 86_400_000;

export type InterestTotals = { daily: bigint; monthly: bigint };
export type InterestTerms = { dueDate: string; dailyPct: number; monthlyPct: number };

export function roundedInterest(value: bigint): number {
  return Number((value + DENOMINATOR / ROUNDING_DIVISOR) / DENOMINATOR);
}

export function accrueInterest(input: {
  terms: InterestTerms;
  from: string;
  through: string;
  principalCents: number;
}): InterestTotals {
  const { terms, through, principalCents } = input;
  let from = input.from;
  if (from < terms.dueDate) from = terms.dueDate;
  if (through <= from) return { daily: 0n, monthly: 0n };
  const days = (Date.parse(through) - Date.parse(from)) / MILLISECONDS_PER_DAY;
  let anniversaries = 0;
  for (let month = 1; addCalendarMonths(terms.dueDate, month) <= through; month++) {
    if (addCalendarMonths(terms.dueDate, month) > from) anniversaries++;
  }
  const principal = BigInt(principalCents);
  return {
    daily: principal * BigInt(Math.round(terms.dailyPct * RATE_SCALE)) * BigInt(days),
    monthly: principal * BigInt(Math.round(terms.monthlyPct * RATE_SCALE)) * BigInt(anniversaries),
  };
}
