import type { InstallmentLedger, OverdueAgeBucket } from "./finance-ledger.js";
import { saoPauloDateOnly } from "./session-time.js";

type DateInput = Date | string;

export type ReceivablesSnapshotInstallment = {
  dueDate: DateInput;
  isCollectible: boolean;
  ledger: InstallmentLedger;
};

export type ReceivablesAgeBuckets = {
  days1To7Cents: number;
  days8To30Cents: number;
  days30PlusCents: number;
};

export type ReceivablesSnapshot = {
  expectedThisMonthCents: number;
  receivedThisMonthCents: number;
  overdueCents: number;
  ageBuckets: ReceivablesAgeBuckets;
};

const DATE_ONLY_LENGTH = 10;
const YEAR_START_INDEX = 0;
const MONTH_END_INDEX = 7;

export function isDueInSaoPauloMonth(input: { dueDate: DateInput; now: Date }): boolean {
  const dueDate = toDateOnly(input.dueDate);
  const currentDate = saoPauloDateOnly(input.now);

  return dueDate.slice(YEAR_START_INDEX, MONTH_END_INDEX) === currentDate.slice(0, MONTH_END_INDEX);
}

export function buildReceivablesSnapshot(input: {
  installments: ReceivablesSnapshotInstallment[];
  receivedThisMonthCents: number;
  now: Date;
}): ReceivablesSnapshot {
  let expectedThisMonthCents = 0;
  let overdueCents = 0;
  const ageBuckets: ReceivablesAgeBuckets = {
    days1To7Cents: 0,
    days8To30Cents: 0,
    days30PlusCents: 0,
  };

  for (const installment of input.installments) {
    if (!installment.isCollectible) {
      continue;
    }

    const { ledger } = installment;

    if (isDueInSaoPauloMonth({ dueDate: installment.dueDate, now: input.now })) {
      expectedThisMonthCents += ledger.currentExpectedCents;
    }

    if (ledger.overdueDays <= 0 || ledger.collectibleRemainingCents <= 0) {
      continue;
    }

    overdueCents += ledger.collectibleRemainingCents;
    addAgeBucketAmount({
      buckets: ageBuckets,
      ageBucket: ledger.ageBucket,
      amountCents: ledger.collectibleRemainingCents,
    });
  }

  return {
    expectedThisMonthCents,
    receivedThisMonthCents: input.receivedThisMonthCents,
    overdueCents,
    ageBuckets,
  };
}

function addAgeBucketAmount(input: {
  buckets: ReceivablesAgeBuckets;
  ageBucket: OverdueAgeBucket | null;
  amountCents: number;
}): void {
  if (input.ageBucket === "DAYS_1_TO_7") {
    input.buckets.days1To7Cents += input.amountCents;
    return;
  }

  if (input.ageBucket === "DAYS_8_TO_29") {
    input.buckets.days8To30Cents += input.amountCents;
    return;
  }

  if (input.ageBucket === "DAYS_30_PLUS") {
    input.buckets.days30PlusCents += input.amountCents;
  }
}

function toDateOnly(value: DateInput): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, DATE_ONLY_LENGTH);
  }

  return value.slice(0, DATE_ONLY_LENGTH);
}
