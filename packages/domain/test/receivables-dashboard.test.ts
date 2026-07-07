import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReceivablesSnapshot,
  isDueInSaoPauloMonth,
} from "../src/receivables-dashboard.js";
import { deriveInstallmentLedger } from "../src/finance-ledger.js";

const JULY_TENTH_MIDDAY_UTC = new Date("2026-07-10T15:00:00.000Z");
const DUE_JUNE_FIRST = "2026-06-01";
const DUE_JULY_FIFTH = "2026-07-05";
const DUE_JULY_FIFTEENTH = "2026-07-15";
const DUE_JULY_TWENTY_FIFTH = "2026-07-25";
const DUE_AUGUST_FIFTH = "2026-08-05";

const FIFTY_THOUSAND_CENTS = 50_000;
const FORTY_THOUSAND_CENTS = 40_000;
const THIRTY_THOUSAND_CENTS = 30_000;
const TWENTY_THOUSAND_CENTS = 20_000;
const TEN_THOUSAND_CENTS = 10_000;
const MONTHLY_INTEREST_RATE_PCT = 1;

function ledgerFor(input: {
  dueDate: string;
  amountCents?: number;
  allocations?: Array<{ amountCents: number }>;
}): ReturnType<typeof deriveInstallmentLedger> {
  return deriveInstallmentLedger({
    amountCents: input.amountCents ?? FIFTY_THOUSAND_CENTS,
    dueDate: input.dueDate,
    waivedAt: null,
    orderCancelledAt: null,
    adjustments: [],
    allocations: input.allocations ?? [],
    now: JULY_TENTH_MIDDAY_UTC,
    interestRatePctMonthly: MONTHLY_INTEREST_RATE_PCT,
  });
}

void describe("isDueInSaoPauloMonth", () => {
  void it("returns true when due date is in the current Sao Paulo month", () => {
    assert.equal(
      isDueInSaoPauloMonth({ dueDate: DUE_JULY_FIFTEENTH, now: JULY_TENTH_MIDDAY_UTC }),
      true,
    );
  });

  void it("returns false for other months", () => {
    assert.equal(
      isDueInSaoPauloMonth({ dueDate: DUE_JUNE_FIRST, now: JULY_TENTH_MIDDAY_UTC }),
      false,
    );
    assert.equal(
      isDueInSaoPauloMonth({ dueDate: DUE_AUGUST_FIFTH, now: JULY_TENTH_MIDDAY_UTC }),
      false,
    );
  });
});

void describe("buildReceivablesSnapshot aggregation", () => {
  void it("aggregates expected, overdue, and age buckets from collectible installments", () => {
    const overdueLedger = ledgerFor({ dueDate: DUE_JUNE_FIRST });
    const inMonthLedger = ledgerFor({ dueDate: DUE_JULY_TWENTY_FIFTH });
    const futureLedger = ledgerFor({ dueDate: DUE_AUGUST_FIFTH });

    const snapshot = buildReceivablesSnapshot({
      now: JULY_TENTH_MIDDAY_UTC,
      receivedThisMonthCents: TEN_THOUSAND_CENTS,
      installments: [
        { dueDate: DUE_JUNE_FIRST, isCollectible: true, ledger: overdueLedger },
        { dueDate: DUE_JULY_TWENTY_FIFTH, isCollectible: true, ledger: inMonthLedger },
        { dueDate: DUE_AUGUST_FIFTH, isCollectible: true, ledger: futureLedger },
      ],
    });

    assert.equal(snapshot.expectedThisMonthCents, FIFTY_THOUSAND_CENTS);
    assert.equal(snapshot.receivedThisMonthCents, TEN_THOUSAND_CENTS);
    assert.equal(snapshot.overdueCents, FIFTY_THOUSAND_CENTS);
    assert.deepEqual(snapshot.ageBuckets, {
      days1To7Cents: 0,
      days8To30Cents: 0,
      days30PlusCents: FIFTY_THOUSAND_CENTS,
    });
  });
});

void describe("buildReceivablesSnapshot exclusions", () => {
  void it("skips non-collectible installments", () => {
    const overdueLedger = ledgerFor({ dueDate: DUE_JUNE_FIRST });

    const snapshot = buildReceivablesSnapshot({
      now: JULY_TENTH_MIDDAY_UTC,
      receivedThisMonthCents: 0,
      installments: [{ dueDate: DUE_JUNE_FIRST, isCollectible: false, ledger: overdueLedger }],
    });

    assert.equal(snapshot.expectedThisMonthCents, 0);
    assert.equal(snapshot.overdueCents, 0);
    assert.deepEqual(snapshot.ageBuckets, {
      days1To7Cents: 0,
      days8To30Cents: 0,
      days30PlusCents: 0,
    });
  });
});

void describe("buildReceivablesSnapshot partial payments", () => {
  void it("includes partially paid overdue installments in overdue totals only for remaining", () => {
    const overdueLedger = ledgerFor({
      dueDate: DUE_JUNE_FIRST,
      allocations: [{ amountCents: TWENTY_THOUSAND_CENTS }],
    });

    const snapshot = buildReceivablesSnapshot({
      now: JULY_TENTH_MIDDAY_UTC,
      receivedThisMonthCents: TWENTY_THOUSAND_CENTS,
      installments: [{ dueDate: DUE_JUNE_FIRST, isCollectible: true, ledger: overdueLedger }],
    });

    assert.equal(snapshot.expectedThisMonthCents, 0);
    assert.equal(snapshot.overdueCents, THIRTY_THOUSAND_CENTS);
  });
});

void describe("buildReceivablesSnapshot in-month overdue", () => {
  void it("counts overdue installments due this month toward expected this month", () => {
    const overdueInMonthLedger = ledgerFor({
      dueDate: DUE_JULY_FIFTH,
      allocations: [{ amountCents: TEN_THOUSAND_CENTS }],
    });

    const snapshot = buildReceivablesSnapshot({
      now: JULY_TENTH_MIDDAY_UTC,
      receivedThisMonthCents: TEN_THOUSAND_CENTS,
      installments: [
        { dueDate: DUE_JULY_FIFTH, isCollectible: true, ledger: overdueInMonthLedger },
      ],
    });

    assert.equal(snapshot.expectedThisMonthCents, FIFTY_THOUSAND_CENTS);
    assert.equal(snapshot.overdueCents, FORTY_THOUSAND_CENTS);
  });
});
