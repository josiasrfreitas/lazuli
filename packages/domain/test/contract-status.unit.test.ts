import assert from "node:assert/strict";
import { it } from "node:test";

import {
  deriveContractFinancialSummary,
  deriveContractServiceStatus,
} from "../src/contract-status.js";

for (const [instant, expected] of [
  ["2026-03-15T02:59:59.999Z", "NOT_STARTED"],
  ["2026-03-15T03:00:00Z", "ACTIVE"],
  ["2027-03-15T03:00:00Z", "ACTIVE"],
  ["2027-03-16T02:59:59.999Z", "ACTIVE"],
  ["2027-03-16T03:00:00Z", "ENDED"],
]) {
  void it(`derives ${expected} at ${instant} with inclusive Sao Paulo dates`, () => {
    assert.equal(
      deriveContractServiceStatus({
        startsOn: "2026-03-15",
        endsOn: "2027-03-15",
        now: new Date(instant!),
      }),
      expected,
    );
  });
}

const NOW = new Date("2026-02-10T03:00:00Z");
function installment(
  dueDate = "2026-02-10",
): Parameters<typeof deriveContractFinancialSummary>[0]["installments"][number] {
  return { amountCents: 25_000, dueDate, waivedAt: null, adjustments: [], allocations: [] };
}

void it("separates registered overdue, today and future balances without interest previews", () => {
  const result = deriveContractFinancialSummary({
    now: NOW,
    cancelledAt: null,
    installmentCount: 3,
    installments: [
      {
        ...installment("2026-01-10"),
        dueDate: new Date("2026-01-10T00:00:00Z"),
        adjustments: [{ amountCents: 1_000 }],
        allocations: [{ amountCents: 10_000 }],
      },
      installment(),
      { ...installment("2026-03-10"), adjustments: [{ amountCents: -2_000 }] },
    ],
  });
  assert.equal(result.status, "INADIMPLENTE");
  assert.deepEqual(result.financialSummary, {
    overdueCents: 16_000,
    dueTodayCents: 25_000,
    futureCents: 23_000,
    zeroedByAdjustment: 0,
  });
  assert.deepEqual(result.paymentProgress, { paid: 0, total: 3, waived: 0, cancelled: 0 });
});

for (const [name, fact, status, paid, waived, zeroed] of [
  ["unpaid", installment(), "EM_DIA", 0, 0, 0],
  [
    "split payment",
    { ...installment(), allocations: [{ amountCents: 10_000 }, { amountCents: 15_000 }] },
    "QUITADO",
    1,
    0,
    0,
  ],
  [
    "discounted payment",
    {
      ...installment(),
      adjustments: [{ amountCents: -2_000 }],
      allocations: [{ amountCents: 23_000 }],
    },
    "QUITADO",
    1,
    0,
    0,
  ],
  ["waiver", { ...installment(), waivedAt: NOW }, "SEM_SALDO", 0, 1, 0],
  [
    "zero adjustment",
    { ...installment(), adjustments: [{ amountCents: -25_000 }] },
    "SEM_SALDO",
    0,
    0,
    1,
  ],
] as const) {
  void it(`distinguishes ${name} from other ways to settle the balance`, () => {
    const result = deriveContractFinancialSummary({
      now: NOW,
      cancelledAt: null,
      installmentCount: 1,
      installments: [
        { ...fact, adjustments: [...fact.adjustments], allocations: [...fact.allocations] },
      ],
    });
    assert.equal(result.status, status);
    assert.deepEqual(result.paymentProgress, { paid, total: 1, waived, cancelled: 0 });
    assert.equal(result.financialSummary.zeroedByAdjustment, zeroed);
  });
}

void it("preserves payment and waiver counts when the financial order is cancelled", () => {
  const result = deriveContractFinancialSummary({
    now: NOW,
    cancelledAt: NOW,
    installmentCount: 3,
    installments: [
      { ...installment(), allocations: [{ amountCents: 25_000 }] },
      { ...installment(), waivedAt: NOW },
      installment("2026-01-10"),
    ],
  });
  assert.equal(result.status, "CANCELADO");
  assert.deepEqual(result.paymentProgress, { paid: 1, total: 3, waived: 1, cancelled: 1 });
  assert.deepEqual(result.financialSummary, {
    overdueCents: 0,
    dueTodayCents: 0,
    futureCents: 0,
    zeroedByAdjustment: 0,
  });
});

void it("does not call an empty or incomplete payment plan paid", () => {
  for (const installments of [[], [{ ...installment(), allocations: [{ amountCents: 25_000 }] }]]) {
    const result = deriveContractFinancialSummary({
      now: NOW,
      cancelledAt: null,
      installmentCount: 2,
      installments,
    });
    assert.equal(result.status, "SEM_SALDO");
    assert.equal(result.paymentProgress.total, 2);
  }
});

void it("moves today's unpaid amount into overdue only after Sao Paulo midnight", () => {
  const input = { cancelledAt: null, installmentCount: 1, installments: [installment()] };
  const before = deriveContractFinancialSummary({
    ...input,
    now: new Date("2026-02-11T02:59:59.999Z"),
  });
  const after = deriveContractFinancialSummary({ ...input, now: new Date("2026-02-11T03:00:00Z") });
  assert.equal(before.status, "EM_DIA");
  assert.equal(before.financialSummary.dueTodayCents, 25_000);
  assert.equal(after.status, "INADIMPLENTE");
  assert.equal(after.financialSummary.overdueCents, 25_000);
  assert.equal(after.financialSummary.dueTodayCents, 0);
});

void it("keeps equal today and future balances open, including database date values", () => {
  const result = deriveContractFinancialSummary({
    now: NOW,
    cancelledAt: null,
    installmentCount: 2,
    installments: [
      { ...installment(), dueDate: new Date("2026-02-10T00:00:00Z") },
      installment("2026-03-10"),
    ],
  });
  assert.equal(result.status, "EM_DIA");
  assert.deepEqual(result.financialSummary, {
    overdueCents: 0,
    dueTodayCents: 25_000,
    futureCents: 25_000,
    zeroedByAdjustment: 0,
  });
});

void it("does not infer payment for a plan with no installments", () => {
  const result = deriveContractFinancialSummary({
    now: NOW,
    cancelledAt: null,
    installmentCount: 0,
    installments: [],
  });
  assert.equal(result.status, "SEM_SALDO");
  assert.deepEqual(result.paymentProgress, { paid: 0, total: 0, waived: 0, cancelled: 0 });
});
