import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteSettlement, type SettlementInput } from "../src/payment-settlement.js";

const overdue: SettlementInput = {
  nominalCents: 100_000,
  terms: { dueDate: "2026-01-31", dailyPct: 0.1, monthlyPct: 2, discountPct: 0 },
  payments: [],
  principalAdjustments: [],
  postedInterestCents: 0,
  effectiveDate: "2026-02-10",
};
void describe("payment settlement", () => {
  void it("allocates partial receipts to interest first and charges only incremental simple interest", () => {
    assert.deepEqual(quoteSettlement({ ...overdue, receivedCents: 21_000 }), {
      balanceCents: 100_000,
      newInterestCents: 1000,
      discountCents: 0,
      settlementCents: 101_000,
      receivedCents: 21_000,
      remainingCents: 80_000,
    });
    const second = {
      ...overdue,
      effectiveDate: "2026-02-28",
      postedInterestCents: 1000,
      payments: [{ date: "2026-02-10", amountCents: 21_000 }],
    };
    assert.equal(quoteSettlement(second).newInterestCents, 3040);
    assert.equal(quoteSettlement({ ...second, receivedCents: 13_040 }).remainingCents, 70_000);
    const third = quoteSettlement({
      ...second,
      effectiveDate: "2026-03-31",
      postedInterestCents: 4040,
      payments: [...second.payments, { date: "2026-02-28", amountCents: 13_040 }],
    });
    assert.equal(third.newInterestCents, 3570);
    assert.equal(third.settlementCents, 73_570);
  });
  void it("awards punctuality only when cumulative effective receipts complete the discounted price", () => {
    const timely = {
      ...overdue,
      nominalCents: 25_000,
      effectiveDate: "2026-01-31",
      terms: { ...overdue.terms, discountPct: 8 },
    };
    assert.equal(quoteSettlement(timely).receivedCents, 23_000);
    assert.equal(quoteSettlement({ ...timely, receivedCents: 10_000 }).remainingCents, 15_000);
    assert.equal(quoteSettlement({ ...timely, receivedCents: 10_000 }).discountCents, 0);
    const completed = quoteSettlement({
      ...timely,
      payments: [{ date: "2026-01-30", amountCents: 10_000 }],
    });
    assert.equal(completed.receivedCents, 13_000);
    assert.equal(completed.discountCents, 2000);
    assert.equal(completed.remainingCents, 0);
  });
  void it("keeps February clamping from moving March anniversaries, including leap years", () => {
    for (const [date, days, months] of [
      ["2028-02-28", 28, 0],
      ["2028-02-29", 29, 1],
      ["2028-03-30", 59, 1],
      ["2028-03-31", 60, 2],
    ] as const) {
      assert.equal(
        quoteSettlement({
          ...overdue,
          terms: { ...overdue.terms, dueDate: "2028-01-31" },
          effectiveDate: date,
        }).newInterestCents,
        days * 100 + months * 2000,
      );
    }
  });
  void it("carries fractional cents across receipts instead of rounding each interval", () => {
    const tiny = {
      ...overdue,
      nominalCents: 100,
      terms: { ...overdue.terms, dailyPct: 0.5, monthlyPct: 0 },
      effectiveDate: "2026-02-02",
    };
    assert.equal(quoteSettlement(tiny).newInterestCents, 1);
    assert.equal(
      quoteSettlement({
        ...tiny,
        postedInterestCents: 1,
        payments: [{ date: "2026-02-01", amountCents: 1 }],
      }).newInterestCents,
      0,
    );
  });
  void it("rejects dates preceding an existing receipt and never capitalizes unpaid interest", () => {
    assert.throws(
      () => quoteSettlement({ ...overdue, payments: [{ date: "2026-02-11", amountCents: 1 }] }),
      /anterior/,
    );
    const result = quoteSettlement({
      ...overdue,
      effectiveDate: "2026-02-20",
      postedInterestCents: 1000,
      payments: [{ date: "2026-02-10", amountCents: 500 }],
    });
    assert.equal(result.newInterestCents, 1000);
    assert.equal(result.settlementCents, 101_500);
  });
});

void it("uses dated principal adjustments before and between partial payments", () => {
  // Jan 31: 1000 - 200 = 800; Feb 10: interest 8, receipt 108 leaves 700.
  // Feb 15: interest 3.50, correction +100 leaves 800; Feb 20: interest 4,
  // receipt 107.50 leaves 700. Feb 28 adds 5.60 daily +14 monthly.
  const result = quoteSettlement({
    ...overdue,
    effectiveDate: "2026-02-28",
    postedInterestCents: 1550,
    principalAdjustments: [
      { date: "2026-01-31", amountCents: -20_000 },
      { date: "2026-02-15", amountCents: 10_000 },
    ],
    payments: [
      { date: "2026-02-10", amountCents: 10_800 },
      { date: "2026-02-20", amountCents: 10_750 },
    ],
  });
  assert.equal(result.newInterestCents, 1960);
  assert.equal(result.settlementCents, 71_960);
});

void it("keeps a settled ledger closed when an older punctuality discount has only its recording date", () => {
  const result = quoteSettlement({
    ...overdue,
    effectiveDate: "2026-09-30",
    terms: { ...overdue.terms, discountPct: 20 },
    principalAdjustments: [{ date: "2026-09-29", amountCents: -20_000 }],
    payments: [{ date: "2026-01-31", amountCents: 80_000 }],
  });
  assert.equal(result.balanceCents, 0);
  assert.equal(result.newInterestCents, 0);
  assert.equal(result.settlementCents, 0);
});
