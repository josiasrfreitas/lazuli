import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  quoteSettlement,
  settlementInterestDetails,
  type SettlementInput,
} from "../src/payment-settlement.js";

const overdue: SettlementInput = {
  nominalCents: 100_000,
  terms: { dueDate: "2026-01-31", monthlyPct: 2, discountPct: 0 },
  payments: [],
  principalAdjustments: [],
  postedInterestCents: 0,
  effectiveDate: "2026-02-10",
};
void describe("payment settlement", () => {
  void it("starts charging interest on refunded principal only after the refund date", () => {
    const input: SettlementInput = {
      nominalCents: 10_000,
      terms: { dueDate: "2026-01-01", monthlyPct: 3, discountPct: 0 },
      payments: [{ date: "2026-01-01", amountCents: 10_000 }],
      refunds: [{ date: "2026-01-31", amountCents: 10_000 }],
      principalAdjustments: [],
      postedInterestCents: 0,
      effectiveDate: "2026-01-31",
    };
    assert.equal(quoteSettlement(input).newInterestCents, 0);
    assert.equal(quoteSettlement(input).balanceCents, 10_000);
    assert.equal(quoteSettlement({ ...input, effectiveDate: "2026-02-10" }).newInterestCents, 100);
    assert.equal(
      quoteSettlement({
        ...input,
        refunds: [{ date: "2026-01-31", amountCents: 4_000 }],
        effectiveDate: "2026-02-10",
      }).newInterestCents,
      40,
    );
  });
  void it("reopens charges paid by a later refund before adding refunded principal", () => {
    const input: SettlementInput = {
      nominalCents: 10_000,
      terms: { dueDate: "2026-01-01", monthlyPct: 3, discountPct: 0 },
      payments: [{ date: "2026-01-11", amountCents: 10_100 }],
      refunds: [{ date: "2026-01-21", amountCents: 500 }],
      principalAdjustments: [],
      postedInterestCents: 100,
      effectiveDate: "2026-01-21",
    };
    const result = quoteSettlement(input);
    assert.equal(result.balanceCents, 500);
    assert.equal(result.outstandingChargesCents, 100);
    assert.equal(result.newInterestCents, 0);
    assert.equal(quoteSettlement({ ...input, effectiveDate: "2026-01-31" }).newInterestCents, 4);
  });
  void it("does not reopen charges paid by another receipt", () => {
    const input: SettlementInput = {
      nominalCents: 10_000,
      terms: { dueDate: "2026-01-01", monthlyPct: 3, discountPct: 0 },
      payments: [
        { sourceId: "first", date: "2026-01-01", amountCents: 5_000 },
        { sourceId: "second", date: "2026-01-11", amountCents: 5_050 },
      ],
      refunds: [{ sourceId: "first", date: "2026-01-21", amountCents: 5_000 }],
      principalAdjustments: [],
      postedInterestCents: 50,
      effectiveDate: "2026-02-20",
    };
    const result = quoteSettlement(input);
    assert.equal(result.balanceCents, 5_000);
    assert.equal(result.newInterestCents, 150);
    assert.equal(result.outstandingChargesCents, 150);
  });
  void it("allocates partial receipts to interest first and charges only incremental simple interest", () => {
    assert.deepEqual(quoteSettlement({ ...overdue, receivedCents: 20_667 }), {
      outstandingChargesCents: 667,
      balanceCents: 100_000,
      newInterestCents: 667,
      discountCents: 0,
      settlementCents: 100_667,
      receivedCents: 20_667,
      remainingCents: 80_000,
    });
    const second = {
      ...overdue,
      effectiveDate: "2026-02-28",
      postedInterestCents: 667,
      payments: [{ date: "2026-02-10", amountCents: 20_667 }],
    };
    assert.equal(quoteSettlement(second).newInterestCents, 960);
    assert.equal(quoteSettlement({ ...second, receivedCents: 10_960 }).remainingCents, 70_000);
    const third = quoteSettlement({
      ...second,
      effectiveDate: "2026-03-31",
      postedInterestCents: 1627,
      payments: [...second.payments, { date: "2026-02-28", amountCents: 10_960 }],
    });
    assert.equal(third.newInterestCents, 1446);
    assert.equal(third.settlementCents, 71_446);
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
  void it("prorates actual elapsed days on a 30-day basis across leap February", () => {
    for (const [date, expectedCents] of [
      ["2028-02-28", 1867],
      ["2028-02-29", 1933],
      ["2028-03-30", 3933],
      ["2028-03-31", 4000],
    ] as const) {
      assert.equal(
        quoteSettlement({
          ...overdue,
          terms: { ...overdue.terms, dueDate: "2028-01-31" },
          effectiveDate: date,
        }).newInterestCents,
        expectedCents,
      );
    }
  });
  void it("carries fractional cents across receipts instead of rounding each interval", () => {
    const tiny = {
      ...overdue,
      nominalCents: 1000,
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
      postedInterestCents: 667,
      payments: [{ date: "2026-02-10", amountCents: 500 }],
    });
    assert.equal(result.newInterestCents, 666);
    assert.equal(result.settlementCents, 100_833);
  });
});

void it("uses dated principal adjustments before and between partial payments", () => {
  // Each interval is 15 days (1%): 800 + 700 + 800 + 700 cents.
  // Receipts cover accrued charges first, leaving 70,000 cents of principal.
  const result = quoteSettlement({
    ...overdue,
    terms: { ...overdue.terms, dueDate: "2026-01-01" },
    effectiveDate: "2026-03-02",
    postedInterestCents: 2300,
    principalAdjustments: [
      { date: "2026-01-01", amountCents: -20_000 },
      { date: "2026-01-31", amountCents: 10_000 },
    ],
    payments: [
      { date: "2026-01-16", amountCents: 10_800 },
      { date: "2026-02-15", amountCents: 11_500 },
    ],
  });
  assert.equal(result.newInterestCents, 700);
  assert.equal(result.settlementCents, 70_700);
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

void it("forgives only accrued charges and pauses simple interest without changing the unpaid principal", () => {
  const input: SettlementInput = {
    ...overdue,
    effectiveDate: "2026-02-25",
    postedInterestCents: 667,
    chargeAdjustments: [{ date: "2026-02-10", amountCents: -500 }],
    suspensions: [{ date: "2026-02-10", newDueDate: "2026-02-20" }],
    payments: [{ date: "2026-02-15", amountCents: 20_167 }],
  };
  // Five days on 80,000 cents at 2%/30, carrying the earlier fraction: 266 new cents.
  const result = quoteSettlement(input);
  assert.equal(result.newInterestCents, 266);
  assert.equal(result.outstandingChargesCents, 266);
  assert.equal(result.settlementCents, 80_266);
  const suspended = quoteSettlement({ ...input, effectiveDate: "2026-02-20" });
  assert.equal(suspended.newInterestCents, 0);
  assert.equal(suspended.settlementCents, 80_000);
});
void it("does not restore the punctuality discount when an agreement moves the due date", () => {
  const result = quoteSettlement({
    ...overdue,
    effectiveDate: "2026-02-15",
    terms: { ...overdue.terms, discountPct: 20 },
    suspensions: [{ date: "2026-01-20", newDueDate: "2026-02-20" }],
  });
  assert.equal(result.discountCents, 0);
  assert.equal(result.newInterestCents, 0);
  assert.equal(result.settlementCents, 100_000);
});

void it("charges a single 2% monthly rate proportionally without a monthly anniversary surcharge", () => {
  for (const [date, expectedCents] of [
    ["2026-01-30", 0],
    ["2026-01-31", 0],
    ["2026-02-01", 67],
    ["2026-02-15", 1000],
    ["2026-03-02", 2000],
    ["2026-03-03", 2067],
    ["2026-03-17", 3000],
    ["2026-04-01", 4000],
  ] as const) {
    assert.equal(
      quoteSettlement({ ...overdue, effectiveDate: date }).newInterestCents,
      expectedCents,
      date,
    );
  }
});

void it("explains the exact days, principal and daily interest behind a simple quote", () => {
  const details = settlementInterestDetails({ ...overdue, effectiveDate: "2026-02-15" });
  assert.deepEqual(details, {
    monthlyPct: 2,
    dailyPct: 2 / 30,
    overdueDays: 15,
    postedInterestCents: 0,
    accruedInterestCents: 1000,
    periods: [
      {
        from: "2026-01-31",
        through: "2026-02-15",
        days: 15,
        principalCents: 100_000,
        dailyInterestCents: 200 / 3,
      },
    ],
  });
});

void it("explains changed principal and excludes suspended days from charged periods", () => {
  const details = settlementInterestDetails({
    ...overdue,
    effectiveDate: "2026-02-25",
    postedInterestCents: 667,
    chargeAdjustments: [{ date: "2026-02-10", amountCents: -500 }],
    suspensions: [{ date: "2026-02-10", newDueDate: "2026-02-20" }],
    payments: [{ date: "2026-02-15", amountCents: 20_167 }],
  });
  assert.equal(details.overdueDays, 25);
  assert.equal(details.accruedInterestCents, 933);
  assert.equal(details.postedInterestCents, 667);
  assert.deepEqual(details.periods, [
    {
      from: "2026-01-31",
      through: "2026-02-10",
      days: 10,
      principalCents: 100_000,
      dailyInterestCents: 200 / 3,
    },
    {
      from: "2026-02-20",
      through: "2026-02-25",
      days: 5,
      principalCents: 80_000,
      dailyInterestCents: 160 / 3,
    },
  ]);
});
