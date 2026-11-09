import assert from "node:assert/strict";
import { it } from "node:test";
import { invoiceTotals } from "../../src/features/students/profile/contract-invoice-totals.js";
import type { FinanceSchedule } from "../../src/features/students/profile/contract-invoice.js";

function schedule(overrides: Partial<FinanceSchedule> = {}): FinanceSchedule {
  return {
    id: "tuition",
    kind: "TUITION",
    dueDay: 5,
    firstDueDate: "2026-04-05",
    totalCents: 300_000,
    installmentCount: 12,
    uniformAmountCents: 25_000,
    material: null,
    materialName: null,
    collection: {
      receivedCents: 157_500,
      balanceCents: 125_000,
      paidCount: 7,
      waivedCount: 0,
      overdueCount: 1,
      count: 12,
    },
    ...overrides,
  };
}

void it("makes applied discounts explicit between nominal tuition, receipts and balance", () => {
  assert.deepEqual(invoiceTotals([schedule()]), {
    subtotal: 300_000,
    discounts: 0,
    fee: 0,
    adjustments: -17_500,
    received: 157_500,
    balance: 125_000,
  });
});

void it("separates the card fee from the school's net material receipt", () => {
  const material = schedule({
    kind: "MATERIAL",
    totalCents: 80_000,
    collection: {
      receivedCents: 80_000,
      balanceCents: 0,
      paidCount: 1,
      waivedCount: 0,
      overdueCount: 0,
      count: 1,
    },
    material: {
      name: "Connect",
      listPriceCents: 80_000,
      payment: "INSTALLMENTS",
      quotedInstallments: 4,
      quotedInstallmentCents: 22_000,
      chargedAmountCents: 88_000,
      cardFeePct: 10,
      cardFeeCents: 8_000,
      scholarshipPct: 0,
      scholarshipAgreement: null,
      items: [],
    },
  });
  assert.deepEqual(invoiceTotals([material]), {
    subtotal: 88_000,
    discounts: 0,
    fee: 8_000,
    adjustments: 0,
    received: 80_000,
    balance: 0,
  });
});

void it("keeps additional charges distinct from receipts and outstanding principal", () => {
  const increased = schedule({
    totalCents: 25_000,
    collection: {
      receivedCents: 10_000,
      balanceCents: 17_500,
      paidCount: 0,
      waivedCount: 0,
      overdueCount: 1,
      count: 1,
    },
  });
  assert.deepEqual(invoiceTotals([increased]), {
    subtotal: 25_000,
    discounts: 0,
    fee: 0,
    adjustments: 2_500,
    received: 10_000,
    balance: 17_500,
  });
});

void it("includes the full material price in the subtotal before its full scholarship", () => {
  const material = schedule({
    kind: "MATERIAL",
    totalCents: 0,
    collection: {
      receivedCents: 0,
      balanceCents: 0,
      paidCount: 0,
      waivedCount: 0,
      overdueCount: 0,
      count: 0,
    },
    material: {
      name: "Connect",
      listPriceCents: 81_600,
      payment: "CASH",
      quotedInstallments: 1,
      quotedInstallmentCents: 0,
      chargedAmountCents: 0,
      cardFeePct: 0,
      cardFeeCents: 0,
      scholarshipPct: 100,
      scholarshipAgreement: null,
      items: [],
    },
  });
  assert.deepEqual(invoiceTotals([schedule(), material]), {
    subtotal: 381_600,
    discounts: 81_600,
    fee: 0,
    adjustments: -17_500,
    received: 157_500,
    balance: 125_000,
  });
});

void it("includes tuition before the scholarship and separates that discount from collections", () => {
  const tuition = schedule({
    totalCents: 30_000,
    installmentCount: 2,
    collection: {
      receivedCents: 0,
      balanceCents: 30_000,
      paidCount: 0,
      waivedCount: 0,
      overdueCount: 0,
      count: 2,
    },
  });
  assert.deepEqual(
    invoiceTotals([tuition], {
      baseMonthlyAmountCents: 30_000,
      monthlyAmountCents: 15_000,
      scholarshipPct: 50,
    }),
    {
      subtotal: 60_000,
      discounts: 30_000,
      fee: 0,
      adjustments: 0,
      received: 0,
      balance: 30_000,
    },
  );
});
