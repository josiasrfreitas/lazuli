import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINANCE_INSTALLMENTS_PAGE_SIZE,
  dueDaySchema,
  financeAddInstallmentAdjustmentInputSchema,
  financeBatchReconcileInputSchema,
  financeCreateOrderInputSchema,
  financeInstallmentsInputSchema,
  financeInstallmentsOutputSchema,
  financeRegisterPaymentInputSchema,
  financeUpdateOrderInputSchema,
  financeWaiveInstallmentInputSchema,
  installmentAdjustmentTypeSchema,
  orderKindSchema,
  payerCreateProcedureInputSchema,
  paymentMethodSchema,
} from "../src/finance.js";

const PAYER_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const INSTALLMENT_ID = "44444444-4444-4444-8444-444444444444";
const ARTIFACT_ID = "55555555-5555-4555-8555-555555555555";
const START_DATE = "2026-02-01";
const DUE_DAY_FIFTH = 5;
const DUE_DAY_TENTH = 10;
const DUE_DAY_FIFTEENTH = 15;
const DUE_DAY_TWENTIETH = 20;
const DUE_DAY_TWENTY_FIFTH = 25;
const INVALID_DUE_DAY = 30;
const DISCOUNT_ADJUSTMENT_CENTS = -500;
const OVERLONG_INSTALLMENT_SEARCH_LENGTH = 81;
const LEAP_DAY = "2024-02-29";

const ORDER_FIELDS = {
  kind: "TUITION",
  beneficiaryStudentIds: [STUDENT_ID],
  principalAmountCents: 120_000,
  installmentCount: 3,
  startDate: START_DATE,
  dueDay: DUE_DAY_TENTH,
  signedOrderArtifactId: ARTIFACT_ID,
};

void describe("finance enum input", () => {
  void it("accepts only the school due-day options", () => {
    assert.equal(dueDaySchema.safeParse(DUE_DAY_FIFTH).success, true);
    assert.equal(dueDaySchema.safeParse(DUE_DAY_TENTH).success, true);
    assert.equal(dueDaySchema.safeParse(DUE_DAY_FIFTEENTH).success, true);
    assert.equal(dueDaySchema.safeParse(DUE_DAY_TWENTIETH).success, true);
    assert.equal(dueDaySchema.safeParse(DUE_DAY_TWENTY_FIFTH).success, true);
    assert.equal(dueDaySchema.safeParse(INVALID_DUE_DAY).success, false);
  });

  void it("keeps every order kind, payment method, and adjustment type literal available", () => {
    assert.equal(orderKindSchema.safeParse("TUITION").success, true);
    assert.equal(orderKindSchema.safeParse("ENROLLMENT_FEE").success, true);
    assert.equal(orderKindSchema.safeParse("MATERIAL").success, true);
    assert.equal(orderKindSchema.safeParse("OTHER").success, true);
    assert.equal(orderKindSchema.safeParse("CONTRACT").success, true);
    assert.equal(orderKindSchema.safeParse("SERVICE").success, false);
    assert.equal(paymentMethodSchema.safeParse("PIX").success, true);
    assert.equal(paymentMethodSchema.safeParse("CASH").success, true);
    assert.equal(paymentMethodSchema.safeParse("TRANSFER").success, true);
    assert.equal(paymentMethodSchema.safeParse("CARD").success, true);
    assert.equal(paymentMethodSchema.safeParse("CHEQUE").success, true);
    assert.equal(paymentMethodSchema.safeParse("BOLETO").success, true);
    assert.equal(paymentMethodSchema.safeParse("OTHER").success, true);
    assert.equal(paymentMethodSchema.safeParse("CRYPTO").success, false);
    assert.equal(installmentAdjustmentTypeSchema.safeParse("INTEREST").success, true);
    assert.equal(installmentAdjustmentTypeSchema.safeParse("LATE_FEE").success, true);
    assert.equal(installmentAdjustmentTypeSchema.safeParse("DISCOUNT").success, true);
    assert.equal(installmentAdjustmentTypeSchema.safeParse("CORRECTION").success, true);
  });
});

void describe("finance order input", () => {
  void it("rejects contractual orders in the existing create and update routes", () => {
    assert.equal(
      financeCreateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        kind: "CONTRACT",
        payer: { mode: "existing", payerId: PAYER_ID },
      }).success,
      false,
    );
    assert.equal(
      financeUpdateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        kind: "CONTRACT",
        orderId: ORDER_ID,
      }).success,
      false,
    );
  });

  void it("accepts existing and inline payer modes for order creation", () => {
    const existing = financeCreateOrderInputSchema.parse({
      ...ORDER_FIELDS,
      payer: { mode: "existing", payerId: PAYER_ID },
    });
    const inline = financeCreateOrderInputSchema.parse({
      ...ORDER_FIELDS,
      payer: { mode: "create", name: " Responsavel " },
      signedOrderArtifactId: undefined,
    });

    assert.equal(existing.payer.mode, "existing");
    assert.equal(existing.startDate.toISOString(), "2026-02-01T00:00:00.000Z");
    assert.equal(inline.payer.mode, "create");
    assert.equal(inline.payer.name, "Responsavel");
  });

  void it("rejects commercial order fields that cannot generate installments", () => {
    assert.equal(
      financeCreateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        payer: { mode: "existing", payerId: PAYER_ID },
        beneficiaryStudentIds: [],
      }).success,
      false,
    );
    assert.equal(
      financeCreateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        payer: { mode: "existing", payerId: PAYER_ID },
        principalAmountCents: 0,
      }).success,
      false,
    );
    assert.equal(
      financeCreateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        payer: { mode: "existing", payerId: PAYER_ID },
        installmentCount: 0,
      }).success,
      false,
    );
  });
});

void describe("finance payer input", () => {
  void it("validates direct payer creation text fields", () => {
    const parsed = payerCreateProcedureInputSchema.parse({
      name: " Maria Silva ",
      taxId: null,
      phone: " 82999990000 ",
      email: undefined,
    });

    assert.equal(parsed.name, "Maria Silva");
    assert.equal(parsed.taxId, null);
    assert.equal(parsed.phone, "82999990000");
    assert.equal(payerCreateProcedureInputSchema.safeParse({ name: "   " }).success, false);
  });

  void it("validates update-order identifiers separately from commercial fields", () => {
    const parsed = financeUpdateOrderInputSchema.parse({
      ...ORDER_FIELDS,
      orderId: ORDER_ID,
    });

    assert.equal(parsed.orderId, ORDER_ID);
    assert.equal(
      financeUpdateOrderInputSchema.safeParse({
        ...ORDER_FIELDS,
        orderId: "not-a-uuid",
      }).success,
      false,
    );
  });
});

void describe("finance payment registration input", () => {
  void it("requires payment allocations and accepts zero-value corrections", () => {
    const parsed = financeRegisterPaymentInputSchema.parse({
      payerId: PAYER_ID,
      date: START_DATE,
      amountCents: 0,
      method: "PIX",
      note: " Caixa ",
      externalReference: null,
      allocations: [{ installmentId: INSTALLMENT_ID, amountCents: 0 }],
    });

    assert.equal(parsed.note, "Caixa");
    assert.equal(parsed.allocations[0]?.amountCents, 0);
    assert.equal(
      financeRegisterPaymentInputSchema.safeParse({
        payerId: PAYER_ID,
        date: START_DATE,
        amountCents: -1,
        method: "PIX",
        allocations: [{ installmentId: INSTALLMENT_ID, amountCents: 0 }],
      }).success,
      false,
    );
    assert.equal(
      financeRegisterPaymentInputSchema.safeParse({
        payerId: PAYER_ID,
        date: START_DATE,
        amountCents: 0,
        method: "PIX",
        allocations: [],
      }).success,
      false,
    );
  });
});

void describe("finance batch reconciliation input", () => {
  void it("accepts one batch reconcile installment and rejects an empty selection", () => {
    const parsed = financeBatchReconcileInputSchema.parse({
      date: START_DATE,
      method: "CASH",
      externalReference: undefined,
      installmentIds: [INSTALLMENT_ID],
    });

    assert.equal(parsed.method, "CASH");
    assert.equal(
      financeBatchReconcileInputSchema.safeParse({
        date: START_DATE,
        method: "CASH",
        installmentIds: [],
      }).success,
      false,
    );
  });
});

void describe("finance adjustment input", () => {
  void it("keeps adjustment sign rules in the service layer while validating required text", () => {
    const waiver = financeWaiveInstallmentInputSchema.parse({
      installmentId: INSTALLMENT_ID,
      reason: " Bolsa ",
    });
    const adjustment = financeAddInstallmentAdjustmentInputSchema.parse({
      installmentId: INSTALLMENT_ID,
      type: "DISCOUNT",
      amountCents: DISCOUNT_ADJUSTMENT_CENTS,
      reason: null,
    });

    assert.equal(waiver.reason, "Bolsa");
    assert.equal(adjustment.amountCents, DISCOUNT_ADJUSTMENT_CENTS);
    assert.equal(
      financeAddInstallmentAdjustmentInputSchema.safeParse({
        installmentId: INSTALLMENT_ID,
        type: "INTEREST",
        amountCents: 1.5,
      }).success,
      false,
    );
    assert.equal(
      financeWaiveInstallmentInputSchema.safeParse({
        installmentId: INSTALLMENT_ID,
        reason: "   ",
      }).success,
      false,
    );
  });
});

void it("validates situation and inclusive date and amount ranges", () => {
  const valid = financeInstallmentsInputSchema.parse({
    statuses: ["PAID", "OVERDUE"],
    dueFrom: LEAP_DAY,
    dueTo: LEAP_DAY,
    amountFromCents: 0,
    amountToCents: 0,
  });
  assert.deepEqual(valid.statuses, ["PAID", "OVERDUE"]);
  assert.equal(valid.dueTo, LEAP_DAY);
  assert.equal(valid.amountToCents, 0);
  assert.equal(financeInstallmentsInputSchema.safeParse({ statuses: ["INVALID"] }).success, false);
  assert.equal(financeInstallmentsInputSchema.safeParse({ dueFrom: "2024-02-30" }).success, false);
  assert.equal(
    financeInstallmentsInputSchema.safeParse({ dueFrom: "2024-03-01", dueTo: LEAP_DAY }).success,
    false,
  );
  assert.equal(
    financeInstallmentsInputSchema.safeParse({ amountFromCents: 1, amountToCents: 0 }).success,
    false,
  );
  assert.equal(financeInstallmentsInputSchema.safeParse({ amountFromCents: -1 }).success, false);
});

void describe("finance installments contract", () => {
  void it("defaults the view and page while trimming an empty search", () => {
    const parsed = financeInstallmentsInputSchema.parse({ search: "   " });

    assert.deepEqual(parsed, {
      view: "all",
      page: 1,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
      search: "",
    });
  });

  void it("rejects unsupported views, pages, long searches, and unknown fields", () => {
    assert.equal(financeInstallmentsInputSchema.safeParse({ view: "unknown" }).success, false);
    assert.equal(financeInstallmentsInputSchema.safeParse({ page: 0 }).success, false);
    assert.equal(financeInstallmentsInputSchema.safeParse({ pageSize: 99 }).success, false);
    assert.equal(
      financeInstallmentsInputSchema.safeParse({
        search: "x".repeat(OVERLONG_INSTALLMENT_SEARCH_LENGTH),
      }).success,
      false,
    );
    assert.equal(financeInstallmentsInputSchema.safeParse({ extra: true }).success, false);
  });

  void it("validates the response by its selected view", () => {
    const baseResponse = {
      rows: [],
      page: 2,
      pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
      total: 0,
      pageCount: 0,
      counts: { all: 3, paid: 1, overdue: 2 },
    };

    assert.equal(
      financeInstallmentsOutputSchema.safeParse({ view: "paid", ...baseResponse }).success,
      true,
    );
    assert.equal(
      financeInstallmentsOutputSchema.safeParse({ view: "overdue", ...baseResponse }).success,
      false,
    );
  });
});
