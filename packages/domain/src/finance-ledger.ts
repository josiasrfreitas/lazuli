import { saoPauloDateOnly } from "./session-time.js";

export type InstallmentDisplayStatus =
  | "WAIVED"
  | "PAID"
  | "OVERDUE"
  | "DUE_THIS_MONTH"
  | "UPCOMING";

export type OrderDisplayStatus = "CANCELLED" | "COMPLETED" | "ACTIVE";

export type OverdueAgeBucket = "DAYS_1_TO_7" | "DAYS_8_TO_29" | "DAYS_30_PLUS";

type DateInput = Date | string;
type NullableDateInput = DateInput | null;
type AmountFact = { amountCents: number };

export type DeriveInstallmentLedgerInput = {
  amountCents: number;
  dueDate: DateInput;
  waivedAt: NullableDateInput;
  orderCancelledAt: NullableDateInput;
  adjustments: AmountFact[];
  allocations: AmountFact[];
  now: Date;
  interestRatePctMonthly: number;
};

export type InstallmentLedger = {
  paidAmountCents: number;
  currentExpectedCents: number;
  rawRemainingCents: number;
  collectibleRemainingCents: number;
  status: InstallmentDisplayStatus;
  overdueDays: number;
  interestPreviewCents: number;
  ageBucket: OverdueAgeBucket | null;
};

export type DeriveOrderLedgerInput = {
  cancelledAt: NullableDateInput;
  installments: Array<{
    amountCents: number;
    dueDate: DateInput;
    waivedAt: NullableDateInput;
    adjustments: AmountFact[];
    allocations: AmountFact[];
  }>;
  now: Date;
  interestRatePctMonthly: number;
};

export type OrderLedger = {
  openBalanceCents: number;
  status: OrderDisplayStatus;
};

export type DerivePaymentEntryRemainderInput = {
  amountCents: number;
  allocations: AmountFact[];
};

export type PaymentEntryRemainder = {
  unallocatedRemainderCents: number;
};

const DATE_ONLY_LENGTH = 10;
const YEAR_START_INDEX = 0;
const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const DATE_DAY_START_INDEX = 8;
const MONTH_INDEX_OFFSET = 1;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const DAYS_PER_INTEREST_MONTH = 30;
const PERCENT_DENOMINATOR = 100;
const ONE_WEEK_DAYS = 7;
const THIRTY_DAY_BUCKET_START = 30;

export function deriveInstallmentLedger(
  input: DeriveInstallmentLedgerInput,
): InstallmentLedger {
  const paidAmountCents = sumAmounts(input.allocations);
  const currentExpectedCents = input.amountCents + sumAmounts(input.adjustments);
  const rawRemainingCents = currentExpectedCents - paidAmountCents;
  const isWaived = input.waivedAt !== null;
  const orderIsCancelled = input.orderCancelledAt !== null;
  const collectibleRemainingCents =
    isWaived || orderIsCancelled ? 0 : Math.max(rawRemainingCents, 0);
  const currentSaoPauloDate = saoPauloDateOnly(input.now);
  const dueDate = toDateOnly(input.dueDate);
  const overdueDays = Math.max(calendarDayDifference(currentSaoPauloDate, dueDate), 0);

  return {
    paidAmountCents,
    currentExpectedCents,
    rawRemainingCents,
    collectibleRemainingCents,
    status: deriveInstallmentStatus({
      isWaived,
      paidAmountCents,
      currentExpectedCents,
      overdueDays,
      dueDate,
      currentSaoPauloDate,
    }),
    overdueDays,
    interestPreviewCents: deriveInterestPreviewCents({
      collectibleRemainingCents,
      interestRatePctMonthly: input.interestRatePctMonthly,
      overdueDays,
    }),
    ageBucket: deriveAgeBucket(overdueDays),
  };
}

export function deriveOrderLedger(input: DeriveOrderLedgerInput): OrderLedger {
  if (input.cancelledAt !== null) {
    return { openBalanceCents: 0, status: "CANCELLED" };
  }

  let openBalanceCents = 0;
  for (const installment of input.installments) {
    const ledger = deriveInstallmentLedger({
      ...installment,
      orderCancelledAt: input.cancelledAt,
      now: input.now,
      interestRatePctMonthly: input.interestRatePctMonthly,
    });

    openBalanceCents += ledger.collectibleRemainingCents;
  }

  return {
    openBalanceCents,
    status: openBalanceCents === 0 ? "COMPLETED" : "ACTIVE",
  };
}

export function derivePaymentEntryRemainder(
  input: DerivePaymentEntryRemainderInput,
): PaymentEntryRemainder {
  return {
    unallocatedRemainderCents: input.amountCents - sumAmounts(input.allocations),
  };
}

function deriveInstallmentStatus(input: {
  isWaived: boolean;
  paidAmountCents: number;
  currentExpectedCents: number;
  overdueDays: number;
  dueDate: string;
  currentSaoPauloDate: string;
}): InstallmentDisplayStatus {
  if (input.isWaived) {
    return "WAIVED";
  }

  if (input.paidAmountCents >= input.currentExpectedCents) {
    return "PAID";
  }

  if (input.overdueDays > 0) {
    return "OVERDUE";
  }

  if (sameYearMonth(input.dueDate, input.currentSaoPauloDate)) {
    return "DUE_THIS_MONTH";
  }

  return "UPCOMING";
}

function deriveInterestPreviewCents(input: {
  collectibleRemainingCents: number;
  interestRatePctMonthly: number;
  overdueDays: number;
}): number {
  return Math.floor(
    (input.collectibleRemainingCents * input.interestRatePctMonthly * input.overdueDays) /
      PERCENT_DENOMINATOR /
      DAYS_PER_INTEREST_MONTH,
  );
}

function deriveAgeBucket(overdueDays: number): OverdueAgeBucket | null {
  if (overdueDays <= 0) {
    return null;
  }

  if (overdueDays <= ONE_WEEK_DAYS) {
    return "DAYS_1_TO_7";
  }

  if (overdueDays < THIRTY_DAY_BUCKET_START) {
    return "DAYS_8_TO_29";
  }

  return "DAYS_30_PLUS";
}

function sumAmounts(rows: AmountFact[]): number {
  return rows.reduce((total, row) => total + row.amountCents, 0);
}

function sameYearMonth(leftDate: string, rightDate: string): boolean {
  return leftDate.slice(YEAR_START_INDEX, MONTH_END_INDEX) === rightDate.slice(0, MONTH_END_INDEX);
}

function calendarDayDifference(laterDate: string, earlierDate: string): number {
  return (dateOnlyUtcMilliseconds(laterDate) - dateOnlyUtcMilliseconds(earlierDate)) /
    MILLISECONDS_PER_DAY;
}

function dateOnlyUtcMilliseconds(value: string): number {
  const year = Number(value.slice(YEAR_START_INDEX, YEAR_END_INDEX));
  const monthIndex = Number(value.slice(MONTH_START_INDEX, MONTH_END_INDEX)) - MONTH_INDEX_OFFSET;
  const day = Number(value.slice(DATE_DAY_START_INDEX, DATE_ONLY_LENGTH));

  return Date.UTC(year, monthIndex, day);
}

function toDateOnly(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, DATE_ONLY_LENGTH);
  }

  return value.slice(0, DATE_ONLY_LENGTH);
}
