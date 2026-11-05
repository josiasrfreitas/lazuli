import assert from "node:assert/strict";
import { it } from "node:test";
import {
  deriveInstallmentLedger,
  deriveInstallmentLedgers,
  type DeriveInstallmentLedgerInput,
} from "../src/finance-ledger.js";

void it("derives a batch with the same calendar and financial rules across Sao Paulo boundaries", () => {
  const installments: Array<Omit<DeriveInstallmentLedgerInput, "now">> = [
    {
      amountCents: 10_000,
      dueDate: "2026-12-31",
      waivedAt: null,
      orderCancelledAt: null,
      adjustments: [{ amountCents: -500 }],
      allocations: [{ amountCents: 3000 }],
    },
    {
      amountCents: 8000,
      dueDate: "2027-01-01",
      waivedAt: null,
      orderCancelledAt: null,
      adjustments: [],
      allocations: [{ amountCents: 8000 }],
    },
    {
      amountCents: 7000,
      dueDate: "2026-12-01",
      waivedAt: new Date("2026-12-02"),
      orderCancelledAt: null,
      adjustments: [],
      allocations: [],
    },
    {
      amountCents: 6000,
      dueDate: "2026-12-31",
      waivedAt: null,
      orderCancelledAt: new Date("2026-12-30"),
      adjustments: [],
      allocations: [],
    },
  ];
  for (const now of [new Date("2027-01-01T02:59:59.999Z"), new Date("2027-01-01T03:00:00Z")]) {
    assert.deepEqual(
      deriveInstallmentLedgers({ installments, now }),
      installments.map((installment) => deriveInstallmentLedger({ ...installment, now })),
    );
  }
  const ledgers = deriveInstallmentLedgers({ installments, now: new Date("2027-01-01T03:00:00Z") });
  assert.deepEqual(
    ledgers.map(({ status, collectibleRemainingCents, overdueDays }) => ({
      status,
      collectibleRemainingCents,
      overdueDays,
    })),
    [
      { status: "OVERDUE", collectibleRemainingCents: 6500, overdueDays: 1 },
      { status: "PAID", collectibleRemainingCents: 0, overdueDays: 0 },
      { status: "WAIVED", collectibleRemainingCents: 0, overdueDays: 31 },
      { status: "OVERDUE", collectibleRemainingCents: 0, overdueDays: 1 },
    ],
  );
});

void it("converts the business instant once for a batch", (context) => {
  const original = Reflect.get(Intl.DateTimeFormat.prototype, "formatToParts");
  let conversions = 0;
  context.mock.method(
    Intl.DateTimeFormat.prototype,
    "formatToParts",
    function (this: Intl.DateTimeFormat, date?: Date | number) {
      conversions += 1;
      return original.call(this, date);
    },
  );
  const installment = {
    amountCents: 100,
    dueDate: "2026-11-01",
    waivedAt: null,
    orderCancelledAt: null,
    adjustments: [],
    allocations: [],
  };
  const result = deriveInstallmentLedgers({
    installments: Array.from({ length: 100 }, () => installment),
    now: new Date("2026-11-03T15:00:00Z"),
  });
  assert.equal(result.length, 100);
  assert.equal(result[99]?.collectibleRemainingCents, 100);
  assert.equal(conversions, 1);
});
