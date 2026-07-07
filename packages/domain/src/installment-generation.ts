const ALLOWED_DUE_DAYS = [5, 10, 15, 20, 25] as const;
const DATE_ONLY_LENGTH = 10;

export type DueDay = (typeof ALLOWED_DUE_DAYS)[number];

export type GeneratedInstallment = {
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
  const firstCandidate = dateOnDueDay({ year: start.year, monthIndex: start.monthIndex, dueDay: input.dueDay });

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
  if (!ALLOWED_DUE_DAYS.includes(dueDay as DueDay)) {
    throw new InstallmentGenerationError(
      "INVALID_DUE_DAY",
      "Due day must be one of 5, 10, 15, 20, or 25.",
    );
  }
}

function splitPrincipal(principalAmountCents: number, installmentCount: number): number[] {
  const baseAmount = Math.floor(principalAmountCents / installmentCount);
  const remainder = principalAmountCents - baseAmount * installmentCount;

  return Array.from({ length: installmentCount }, (_, index) =>
    index === installmentCount - 1 ? baseAmount + remainder : baseAmount,
  );
}

function parseDateOnly(value: string): { year: number; monthIndex: number; day: number } {
  const year = Number(value.slice(0, 4));
  const monthIndex = Number(value.slice(5, 7)) - 1;
  const day = Number(value.slice(8, DATE_ONLY_LENGTH));

  return { year, monthIndex, day };
}

function addMonths(
  input: { year: number; monthIndex: number },
  months: number,
): { year: number; monthIndex: number } {
  const absoluteMonth = input.year * 12 + input.monthIndex + months;
  return {
    year: Math.floor(absoluteMonth / 12),
    monthIndex: absoluteMonth % 12,
  };
}

function dateOnDueDay(input: {
  year: number;
  monthIndex: number;
  dueDay: number;
}): string {
  const lastDayOfMonth = new Date(Date.UTC(input.year, input.monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(input.dueDay, lastDayOfMonth);
  const month = String(input.monthIndex + 1).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");

  return `${input.year}-${month}-${dayString}`;
}
