import assert from "node:assert/strict";
import { it, type TestContext } from "node:test";

import { finance } from "../../src/finance/index.js";

const NOW = new Date("2026-11-15T15:00:00Z");

function installment(id: string, dueDate: string, waivedAt: Date | null = null) {
  return {
    id,
    orderId: `order-${id}`,
    amountCents: 10_000,
    dueDate: new Date(dueDate),
    waivedAt,
    order: {
      kind: "MATERIAL",
      cancelledAt: null,
      payer: { id: `payer-${id}`, name: `Payer ${id}` },
      contract: null,
      beneficiaries: [],
    },
  };
}

function mockReceivables(context: TestContext) {
  context.mock.timers.enable({ apis: ["Date"], now: NOW });
  const installments = [
    installment("partial", "2026-11-10"),
    installment("paid", "2026-11-01"),
    installment("untouched", "2026-10-01"),
    installment("waived", "2026-11-01", NOW),
    installment("future", "2026-12-01"),
  ];
  const adjustments = [
    { installmentId: "partial", amountCents: -2000 },
    { installmentId: "paid", amountCents: 1000 },
    { installmentId: "partial", amountCents: 500 },
    { installmentId: "waived", amountCents: 700 },
  ];
  const paymentAllocation = {
    findMany: (query: { where: object }) =>
      Promise.resolve(
        "installmentId" in query.where
          ? [
              { installmentId: "paid", amountCents: 11_000 },
              { installmentId: "partial", amountCents: 1000 },
              { installmentId: "waived", amountCents: 500 },
              { installmentId: "partial", amountCents: 2000 },
            ]
          : [{ amountCents: 3000 }, { amountCents: 500 }],
      ),
  };
  return finance(
    stubDatabase(installments, adjustments, paymentAllocation),
    "receivables-test-admin",
  );
}

void it("keeps multiple adjustments and payments scoped to their installment in snapshot totals", async (context) => {
  const module = mockReceivables(context);

  assert.deepEqual(await module.receivablesSnapshot(), {
    expectedThisMonthCents: 19_500,
    receivedThisMonthCents: 3500,
    overdueCents: 15_500,
    ageBuckets: { days1To7Cents: 5500, days8To30Cents: 0, days30PlusCents: 10_000 },
  });
});

void it("preserves per-installment balances, overdue status and exclusions for the shared overdue read", async (context) => {
  const module = mockReceivables(context);
  const { rows } = await module.overdueList();

  assert.deepEqual(
    rows.map(({ installmentId, ledger }) => ({ installmentId, ledger })),
    [
      {
        installmentId: "untouched",
        ledger: {
          paidAmountCents: 0,
          currentExpectedCents: 10_000,
          rawRemainingCents: 10_000,
          collectibleRemainingCents: 10_000,
          status: "OVERDUE",
          overdueDays: 45,
          ageBucket: "DAYS_30_PLUS",
        },
      },
      {
        installmentId: "partial",
        ledger: {
          paidAmountCents: 3000,
          currentExpectedCents: 8500,
          rawRemainingCents: 5500,
          collectibleRemainingCents: 5500,
          status: "OVERDUE",
          overdueDays: 5,
          ageBucket: "DAYS_1_TO_7",
        },
      },
    ],
  );
});

void it("returns zero balances when there are no installments or financial entries", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: NOW });
  const database = stubDatabase([], [], { findMany: () => Promise.resolve([]) });
  const module = finance(database, "receivables-test-admin");

  assert.deepEqual(await module.receivablesSnapshot(), {
    expectedThisMonthCents: 0,
    receivedThisMonthCents: 0,
    overdueCents: 0,
    ageBuckets: { days1To7Cents: 0, days8To30Cents: 0, days30PlusCents: 0 },
  });
  assert.deepEqual(await module.overdueList(), { rows: [] });
});

function stubDatabase(
  installments: ReturnType<typeof installment>[],
  adjustments: Array<{ installmentId: string; amountCents: number }>,
  paymentAllocation: {
    findMany: (query: { where: object }) => Promise<Array<{ amountCents: number }>>;
  },
): Parameters<typeof finance>[0] {
  // Only persistence is stubbed; the public finance module composes and derives the real ledger.
  return {
    installment: { findMany: () => Promise.resolve(installments) },
    installmentAdjustment: { findMany: () => Promise.resolve(adjustments) },
    paymentAllocation,
  } as object as Parameters<typeof finance>[0];
}

void it("builds snapshot totals using only installment and entry facts, without payer/student relations", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: NOW });
  const row = installment("minimal", "2026-11-10");
  Object.defineProperty(row, "order", {
    enumerable: false,
    get() {
      throw new Error("Snapshot must not materialize order parties");
    },
  });
  const database = stubDatabase([row], [], { findMany: () => Promise.resolve([]) });

  assert.deepEqual(await finance(database, "receivables-test-admin").receivablesSnapshot(), {
    expectedThisMonthCents: 10_000,
    receivedThisMonthCents: 0,
    overdueCents: 10_000,
    ageBuckets: { days1To7Cents: 10_000, days8To30Cents: 0, days30PlusCents: 0 },
  });
});

void it("associates financial entries with linear work as the installment list grows", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: NOW });
  const count = 100;
  let associationReads = 0;
  const installments = Array.from({ length: count }, (_, index) =>
    installment(`scale-${index}`, "2026-11-10"),
  );
  const entries = installments.map(({ id }) => ({
    get installmentId() {
      associationReads += 1;
      return id;
    },
    amountCents: 100,
  }));
  const database = stubDatabase(installments, entries, {
    findMany: (query) => Promise.resolve("installmentId" in query.where ? entries : []),
  });

  const snapshot = await finance(database, "receivables-test-admin").receivablesSnapshot();

  assert.equal(snapshot.overdueCents, 1_000_000);
  // Count association work instead of asserting a machine-dependent wall-clock threshold.
  assert.ok(
    associationReads <= count * 10,
    `Expected linear association work; got ${associationReads} reads for ${count} installments`,
  );
});
