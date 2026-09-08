import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type DeriveInstallmentLedgerInput,
  type DeriveOrderLedgerInput,
  deriveInstallmentLedger,
  deriveOrderLedger,
  derivePaymentEntryRemainder,
} from "../src/finance-ledger.js";

const JULY_TENTH_MIDDAY_UTC = new Date("2026-07-10T15:00:00.000Z"); // 12:00 in Sao Paulo.
const JULY_FIRST_MIDDAY_UTC = new Date("2026-07-01T15:00:00.000Z");
const AUGUST_FIRST_MIDDAY_UTC = new Date("2026-08-01T15:00:00.000Z");
const LATE_UTC_STILL_JUNE_IN_SP = new Date("2026-07-01T02:30:00.000Z"); // 2026-06-30 23:30 SP.
const WAIVED_AT = new Date("2026-06-15T12:00:00.000Z");
const CANCELLED_AT = new Date("2026-07-01T12:00:00.000Z");

const DUE_JUNE_FIRST = "2026-06-01";
const DUE_JUNE_TENTH = "2026-06-10";
const DUE_JUNE_TENTH_DATE = new Date("2026-06-10");
const DUE_JUNE_THIRTIETH = "2026-06-30";
const DUE_JULY_FIFTH = "2026-07-05";
const DUE_JULY_TWENTY_FOURTH = "2026-07-24";
const DUE_JULY_TWENTY_FIFTH = "2026-07-25";
const DUE_AUGUST_FIFTH = "2026-08-05";
const DUE_JULY_THIRD = "2026-07-03";

const MONTHLY_INTEREST_RATE_PCT = 1;
const TWO_PERCENT_MONTHLY_INTEREST_RATE = 2;
const TEN_THOUSAND_CENTS = 10_000;
const TWO_HUNDRED_CENTS = 200;
const SEVEN_OVERDUE_DAYS = 7;
const THIRTY_OVERDUE_DAYS = 30;
const LEDGER_DATE_BRANCH_YEAR = 2026;
const JUNE_UTC_MONTH_INDEX = 5;
const JULY_UTC_MONTH_INDEX = 6;
const TENTH_DAY_OF_MONTH = 10;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const THIRTY_DAYS_FROM_JUNE_TENTH_TO_JULY_TENTH =
  (Date.UTC(LEDGER_DATE_BRANCH_YEAR, JULY_UTC_MONTH_INDEX, TENTH_DAY_OF_MONTH) -
    Date.UTC(LEDGER_DATE_BRANCH_YEAR, JUNE_UTC_MONTH_INDEX, TENTH_DAY_OF_MONTH)) /
  MILLISECONDS_PER_DAY;
const INTEREST_PREVIEW_CENTS = 650;
const FIVE_THOUSAND_CENTS = 5000;
const TWENTY_THOUSAND_CENTS = 20_000;
const THIRTY_THOUSAND_CENTS = 30_000;
const FORTY_THOUSAND_CENTS = 40_000;
const FORTY_FIVE_THOUSAND_CENTS = 45_000;
const FIFTY_THOUSAND_CENTS = 50_000;
const SIXTY_THOUSAND_CENTS = 60_000;
const SIXTY_FIVE_THOUSAND_CENTS = 65_000;
const ONE_HUNDRED_THOUSAND_CENTS = 100_000;
const ONE_HUNDRED_FIVE_THOUSAND_CENTS = 105_000;

function installmentInput(
  overrides: Partial<DeriveInstallmentLedgerInput> = {},
): DeriveInstallmentLedgerInput {
  return {
    amountCents: FIFTY_THOUSAND_CENTS,
    dueDate: DUE_JUNE_FIRST,
    waivedAt: null,
    orderCancelledAt: null,
    adjustments: [],
    allocations: [],
    now: JULY_TENTH_MIDDAY_UTC,
    interestRatePctMonthly: MONTHLY_INTEREST_RATE_PCT,
    ...overrides,
  };
}

function orderInstallment(
  overrides: Partial<DeriveOrderLedgerInput["installments"][number]> = {},
): DeriveOrderLedgerInput["installments"][number] {
  return {
    amountCents: FIFTY_THOUSAND_CENTS,
    dueDate: DUE_JUNE_FIRST,
    waivedAt: null,
    adjustments: [],
    allocations: [],
    ...overrides,
  };
}

void describe("deriveInstallmentLedger balances", () => {
  void it("derives balances, overdue status, age bucket, and interest preview", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({
        amountCents: ONE_HUNDRED_THOUSAND_CENTS,
        dueDate: DUE_JUNE_TENTH,
        adjustments: [{ amountCents: FIVE_THOUSAND_CENTS }],
        allocations: [{ amountCents: FORTY_THOUSAND_CENTS }],
      }),
    );

    assert.deepEqual(ledger, {
      paidAmountCents: FORTY_THOUSAND_CENTS,
      currentExpectedCents: ONE_HUNDRED_FIVE_THOUSAND_CENTS,
      rawRemainingCents: SIXTY_FIVE_THOUSAND_CENTS,
      collectibleRemainingCents: SIXTY_FIVE_THOUSAND_CENTS,
      status: "OVERDUE",
      overdueDays: THIRTY_OVERDUE_DAYS,
      interestPreviewCents: INTEREST_PREVIEW_CENTS,
      ageBucket: "DAYS_30_PLUS",
    });
  });

  void it("keeps cancelled order installments non-collectible without changing display status", () => {
    const ledger = deriveInstallmentLedger(installmentInput({ orderCancelledAt: CANCELLED_AT }));

    assert.equal(ledger.status, "OVERDUE");
    assert.equal(ledger.rawRemainingCents, FIFTY_THOUSAND_CENTS);
    assert.equal(ledger.collectibleRemainingCents, 0);
    assert.equal(ledger.interestPreviewCents, 0);
  });
});

void describe("deriveInstallmentLedger status precedence", () => {
  void it("gives waived installments precedence over paid and overdue facts", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({
        waivedAt: WAIVED_AT,
        allocations: [{ amountCents: FIFTY_THOUSAND_CENTS }],
      }),
    );

    assert.equal(ledger.status, "WAIVED");
    assert.equal(ledger.collectibleRemainingCents, 0);
    assert.equal(ledger.interestPreviewCents, 0);
  });

  void it("marks fully allocated installments as paid before overdue", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({
        adjustments: [{ amountCents: -FIVE_THOUSAND_CENTS }],
        allocations: [{ amountCents: FORTY_FIVE_THOUSAND_CENTS }],
      }),
    );

    assert.equal(ledger.status, "PAID");
    assert.equal(ledger.rawRemainingCents, 0);
    assert.equal(ledger.collectibleRemainingCents, 0);
  });
});

void describe("deriveInstallmentLedger interest preview", () => {
  void it("calculates two percent monthly interest over thirty overdue days", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({
        amountCents: TEN_THOUSAND_CENTS,
        dueDate: DUE_JUNE_TENTH,
        now: JULY_TENTH_MIDDAY_UTC,
        interestRatePctMonthly: TWO_PERCENT_MONTHLY_INTEREST_RATE,
      }),
    );

    assert.equal(ledger.interestPreviewCents, TWO_HUNDRED_CENTS);
  });
});

void describe("deriveInstallmentLedger due timing", () => {
  void it("calculates overdue days from a Date due date", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({
        dueDate: DUE_JUNE_TENTH_DATE,
        now: JULY_TENTH_MIDDAY_UTC,
      }),
    );

    assert.equal(ledger.overdueDays, THIRTY_DAYS_FROM_JUNE_TENTH_TO_JULY_TENTH);
  });

  void it("marks unpaid installments due in the current Sao Paulo month", () => {
    const ledger = deriveInstallmentLedger(installmentInput({ dueDate: DUE_JULY_TWENTY_FIFTH }));

    assert.equal(ledger.status, "DUE_THIS_MONTH");
    assert.equal(ledger.overdueDays, 0);
    assert.equal(ledger.ageBucket, null);
  });

  void it("marks unpaid installments after the current Sao Paulo month as upcoming", () => {
    const ledger = deriveInstallmentLedger(installmentInput({ dueDate: DUE_AUGUST_FIFTH }));

    assert.equal(ledger.status, "UPCOMING");
  });
});

void describe("deriveInstallmentLedger Sao Paulo calendar boundaries", () => {
  void it("puts exactly seven overdue days in the first age bucket", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({ dueDate: DUE_JULY_THIRD, now: JULY_TENTH_MIDDAY_UTC }),
    );

    assert.equal(ledger.overdueDays, SEVEN_OVERDUE_DAYS);
    assert.equal(ledger.ageBucket, "DAYS_1_TO_7");
  });

  void it("uses Sao Paulo current month at the UTC month boundary", () => {
    const ledger = deriveInstallmentLedger(
      installmentInput({ dueDate: DUE_JULY_FIFTH, now: LATE_UTC_STILL_JUNE_IN_SP }),
    );

    assert.equal(ledger.status, "UPCOMING");
    assert.equal(ledger.overdueDays, 0);
  });

  void it("uses Sao Paulo calendar days for overdue age buckets", () => {
    assert.equal(
      deriveInstallmentLedger(
        installmentInput({ dueDate: DUE_JUNE_THIRTIETH, now: JULY_FIRST_MIDDAY_UTC }),
      ).ageBucket,
      "DAYS_1_TO_7",
    );
    assert.equal(
      deriveInstallmentLedger(
        installmentInput({ dueDate: DUE_JULY_TWENTY_FOURTH, now: AUGUST_FIRST_MIDDAY_UTC }),
      ).ageBucket,
      "DAYS_8_TO_29",
    );
  });
});

void describe("deriveOrderLedger", () => {
  void it("aggregates collectible installment balances into open order balance", () => {
    const ledger = deriveOrderLedger({
      cancelledAt: null,
      installments: [
        orderInstallment({
          amountCents: SIXTY_THOUSAND_CENTS,
          dueDate: DUE_JUNE_TENTH,
          adjustments: [{ amountCents: FIVE_THOUSAND_CENTS }],
          allocations: [{ amountCents: TWENTY_THOUSAND_CENTS }],
        }),
        orderInstallment({
          amountCents: FORTY_THOUSAND_CENTS,
          dueDate: DUE_JULY_TWENTY_FIFTH,
          allocations: [{ amountCents: FORTY_THOUSAND_CENTS }],
        }),
      ],
      now: JULY_TENTH_MIDDAY_UTC,
      interestRatePctMonthly: MONTHLY_INTEREST_RATE_PCT,
    });

    assert.deepEqual(ledger, { openBalanceCents: FORTY_FIVE_THOUSAND_CENTS, status: "ACTIVE" });
  });

  void it("marks orders completed when all installments are fully paid or waived", () => {
    const ledger = deriveOrderLedger({
      cancelledAt: null,
      installments: [
        orderInstallment({
          amountCents: SIXTY_THOUSAND_CENTS,
          dueDate: DUE_JUNE_TENTH,
          allocations: [{ amountCents: SIXTY_THOUSAND_CENTS }],
        }),
        orderInstallment({ waivedAt: WAIVED_AT, amountCents: FORTY_THOUSAND_CENTS }),
      ],
      now: JULY_TENTH_MIDDAY_UTC,
      interestRatePctMonthly: MONTHLY_INTEREST_RATE_PCT,
    });

    assert.deepEqual(ledger, { openBalanceCents: 0, status: "COMPLETED" });
  });
});

void describe("deriveOrderLedger cancellation", () => {
  void it("marks cancelled orders cancelled and non-collectible", () => {
    const ledger = deriveOrderLedger({
      cancelledAt: CANCELLED_AT,
      installments: [orderInstallment({ amountCents: SIXTY_THOUSAND_CENTS })],
      now: JULY_TENTH_MIDDAY_UTC,
      interestRatePctMonthly: MONTHLY_INTEREST_RATE_PCT,
    });

    assert.deepEqual(ledger, { openBalanceCents: 0, status: "CANCELLED" });
  });
});

void describe("derivePaymentEntryRemainder", () => {
  void it("derives unallocated payment remainder", () => {
    const ledger = derivePaymentEntryRemainder({
      amountCents: ONE_HUNDRED_THOUSAND_CENTS,
      allocations: [{ amountCents: THIRTY_THOUSAND_CENTS }, { amountCents: TWENTY_THOUSAND_CENTS }],
    });

    assert.equal(ledger.unallocatedRemainderCents, FIFTY_THOUSAND_CENTS);
  });
});
