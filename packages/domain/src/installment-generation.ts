export const FINANCE_DUE_DAY_FIFTH = 5;
export const FINANCE_DUE_DAY_TENTH = 10;
export const FINANCE_DUE_DAY_FIFTEENTH = 15;
export const FINANCE_DUE_DAY_TWENTIETH = 20;
export const FINANCE_DUE_DAY_TWENTY_FIFTH = 25;

export const FINANCE_DUE_DAYS = [
  FINANCE_DUE_DAY_FIFTH,
  FINANCE_DUE_DAY_TENTH,
  FINANCE_DUE_DAY_FIFTEENTH,
  FINANCE_DUE_DAY_TWENTIETH,
  FINANCE_DUE_DAY_TWENTY_FIFTH,
] as const;

const DATE_ONLY_LENGTH = 10;
const MONTHS_PER_YEAR = 12;
const YEAR_START_INDEX = 0;
const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const MONTH_INDEX_OFFSET = 1;
const DATE_DAY_START_INDEX = 8;

export type DueDay = (typeof FINANCE_DUE_DAYS)[number];

export type GeneratedInstallment = {
  sequenceNumber: number;
  amountCents: number;
  dueDate: string;
};

export type InstallmentGenerationErrorCode =
  | "INVALID_PRINCIPAL"
  | "INVALID_INSTALLMENT_COUNT"
  | "INVALID_DUE_DAY";

export class InstallmentGenerationError extends Error {
  readonly code: InstallmentGenerationErrorCode;

  constructor(code: InstallmentGenerationErrorCode, message: string) {
    super(message);
    this.name = "InstallmentGenerationError";
    this.code = code;
  }
}

/** Next calendar occurrence of `dueDay` strictly after `startDate` (D-0011). */
export function deriveFirstDueDate(input: { startDate: string; dueDay: number }): string {
  assertDueDay(input.dueDay);

  const start = parseDateOnly(input.startDate);
  const firstCandidate = dateOnDueDay({
    year: start.year,
    monthIndex: start.monthIndex,
    dueDay: input.dueDay,
  });

  if (firstCandidate > input.startDate) {
    return firstCandidate;
  }

  const nextMonth = addMonths({ year: start.year, monthIndex: start.monthIndex }, 1);
  return dateOnDueDay({ ...nextMonth, dueDay: input.dueDay });
}

export function generateInstallments(input: {
  principalAmountCents: number;
  installmentCount: number;
  startDate: string;
  dueDay: number;
}): GeneratedInstallment[] {
  assertGenerationInput(input);

  const amounts = splitPrincipal(input.principalAmountCents, input.installmentCount);
  const firstDueDate = deriveFirstDueDate({ startDate: input.startDate, dueDay: input.dueDay });
  const firstDue = parseDateOnly(firstDueDate);

  return amounts.map((amountCents, index) => ({
    sequenceNumber: index + 1,
    amountCents,
    dueDate: dateOnDueDay({
      ...addMonths({ year: firstDue.year, monthIndex: firstDue.monthIndex }, index),
      dueDay: input.dueDay,
    }),
  }));
}

function assertGenerationInput(input: {
  principalAmountCents: number;
  installmentCount: number;
  dueDay: number;
}): void {
  if (input.principalAmountCents <= 0) {
    throw new InstallmentGenerationError(
      "INVALID_PRINCIPAL",
      "Principal amount must be greater than zero.",
    );
  }

  if (input.installmentCount < 1) {
    throw new InstallmentGenerationError(
      "INVALID_INSTALLMENT_COUNT",
      "Installment count must be at least one.",
    );
  }

  assertDueDay(input.dueDay);
}

function assertDueDay(dueDay: number): asserts dueDay is DueDay {
  if (!FINANCE_DUE_DAYS.includes(dueDay as DueDay)) {
    throw new InstallmentGenerationError(
      "INVALID_DUE_DAY",
      "Due day must be one of 5, 10, 15, 20, or 25.",
    );
  }
}

function splitPrincipal(principalAmountCents: number, installmentCount: number): number[] {
  const baseAmount = Math.floor(principalAmountCents / installmentCount);
  const remainder = principalAmountCents - baseAmount * installmentCount;

  return Array.from({ length: installmentCount }, (_unused, index) =>
    index === installmentCount - 1 ? baseAmount + remainder : baseAmount,
  );
}

function parseDateOnly(value: string): { year: number; monthIndex: number; day: number } {
  const year = Number(value.slice(YEAR_START_INDEX, YEAR_END_INDEX));
  const monthIndex = Number(value.slice(MONTH_START_INDEX, MONTH_END_INDEX)) - MONTH_INDEX_OFFSET;
  const day = Number(value.slice(DATE_DAY_START_INDEX, DATE_ONLY_LENGTH));

  return { year, monthIndex, day };
}

function addMonths(
  input: { year: number; monthIndex: number },
  months: number,
): { year: number; monthIndex: number } {
  const absoluteMonth = input.year * MONTHS_PER_YEAR + input.monthIndex + months;
  return {
    year: Math.floor(absoluteMonth / MONTHS_PER_YEAR),
    monthIndex: absoluteMonth % MONTHS_PER_YEAR,
  };
}

function dateOnDueDay(input: { year: number; monthIndex: number; dueDay: number }): string {
  const lastDayOfMonth = new Date(Date.UTC(input.year, input.monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(input.dueDay, lastDayOfMonth);
  const month = String(input.monthIndex + 1).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");

  return `${input.year}-${month}-${dayString}`;
}
