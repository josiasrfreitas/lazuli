import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { FINANCE_DUE_DAY_FIFTEENTH } from "@lazuli/domain";
import { db, PaymentMethod } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ADJUSTMENT_BELOW_PAID_MESSAGE,
  CANCELLED_ORDER_INSTALLMENT_MESSAGE,
  DISCOUNT_REASON_REQUIRED_MESSAGE,
  INSTALLMENT_ALREADY_WAIVED_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
  INVALID_ADJUSTMENT_SIGN_MESSAGE,
  ORDER_LOCKED_MESSAGE,
  WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
} from "../../src/finance/errors.js";
import {
  ADMIN,
  caller,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
  expectRejects,
} from "./finance-test-support.js";

const WAIVER_TEST_PREFIX = "GRE-47 ";
const PAYMENT_DATE = new Date("2026-04-10T00:00:00.000Z");
const LOCKED_UPDATE_START_DATE = new Date("2026-02-01T00:00:00.000Z");
const MISSING_ENTITY_ID = "00000000-0000-0000-0000-000000000099";
const WAIVER_REASON = "Bolsa integral";
const DISCOUNT_REASON = "Desconto irmao";
const DISCOUNT_AMOUNT_CENTS = -5000;
const INTEREST_AMOUNT_CENTS = 1500;
const CORRECTION_AMOUNT_CENTS = -2000;
const PARTIAL_PAYMENT_CENTS = 10_000;
const FULL_INSTALLMENT_PAYMENT_CENTS = 33_334;
const LOCKED_UPDATE_PRINCIPAL_CENTS = 80_000;
const TWO_INSTALLMENTS = 2;

void describe("finance.waiveInstallment", () => {
  registerWaiverHooks();
  registerWaiveHappyPath();
  registerWaiveGuards();
  registerWaivePreservesPaidRevenue();
});

void describe("finance.addInstallmentAdjustment", () => {
  registerWaiverHooks();
  registerDiscountHappyPath();
  registerAdjustmentGuards();
  registerOtherAdjustmentTypes();
  registerOrderEditCutoffAfterMutation();
});

function registerWaiverHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(WAIVER_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(WAIVER_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerWaiveHappyPath(): void {
  databaseIt("marks an installment waived and derives non-collectible status", async () => {
    const fixture = await createOrderFixture();

    const result = await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    assert.equal(result.installment.id, fixture.installmentId);
    assert.equal(result.installment.waivedReason, WAIVER_REASON);
    assert.ok(result.installment.waivedAt instanceof Date);
    assert.equal(result.ledger.status, "WAIVED");
    assert.equal(result.ledger.collectibleRemainingCents, 0);

    const stored = await db.installment.findUniqueOrThrow({
      where: { id: fixture.installmentId },
    });
    assert.ok(stored.waivedAt instanceof Date);
    assert.equal(stored.waivedReason, WAIVER_REASON);
    assert.equal(stored.updatedById, ADMIN.id);
  });
}

function registerWaiveGuards(): void {
  databaseIt("rejects waiving a fully paid installment", async () => {
    const fixture = await createOrderFixture();
    const paymentEntry = await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: PAYMENT_DATE,
        amountCents: FULL_INSTALLMENT_PAYMENT_CENTS,
        method: PaymentMethod.PIX,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentEntryId: paymentEntry.id,
        installmentId: fixture.installmentId,
        amountCents: FULL_INSTALLMENT_PAYMENT_CENTS,
      },
    });

    await expectRejects(
      caller().finance.waiveInstallment({
        installmentId: fixture.installmentId,
        reason: WAIVER_REASON,
      }),
      INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
    );
  });

  databaseIt("rejects waiving an already waived installment", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    await expectRejects(
      caller().finance.waiveInstallment({
        installmentId: fixture.installmentId,
        reason: "Segunda tentativa",
      }),
      INSTALLMENT_ALREADY_WAIVED_MESSAGE,
    );
  });

  databaseIt("rejects waiving a missing installment", async () => {
    await expectRejects(
      caller().finance.waiveInstallment({
        installmentId: MISSING_ENTITY_ID,
        reason: WAIVER_REASON,
      }),
      INSTALLMENT_NOT_FOUND_MESSAGE,
    );
  });

  databaseIt("rejects waiving installments on cancelled orders", async () => {
    const fixture = await createOrderFixture();
    await db.order.update({
      where: { id: fixture.orderId },
      data: { cancelledAt: new Date(), cancelledReason: "Cliente desistiu" },
    });

    await expectRejects(
      caller().finance.waiveInstallment({
        installmentId: fixture.installmentId,
        reason: WAIVER_REASON,
      }),
      CANCELLED_ORDER_INSTALLMENT_MESSAGE,
    );
  });
}

function registerWaivePreservesPaidRevenue(): void {
  databaseIt("forgives only the remaining balance after partial payment", async () => {
    const fixture = await createOrderFixture();
    const paymentEntry = await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: PAYMENT_DATE,
        amountCents: PARTIAL_PAYMENT_CENTS,
        method: PaymentMethod.PIX,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentEntryId: paymentEntry.id,
        installmentId: fixture.installmentId,
        amountCents: PARTIAL_PAYMENT_CENTS,
      },
    });

    const result = await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    assert.equal(result.ledger.paidAmountCents, PARTIAL_PAYMENT_CENTS);
    assert.equal(result.ledger.collectibleRemainingCents, 0);
    assert.equal(result.ledger.status, "WAIVED");

    const allocations = await db.paymentAllocation.findMany({
      where: { installmentId: fixture.installmentId },
    });
    assert.equal(allocations.length, 1);
    assert.equal(allocations[0]?.amountCents, PARTIAL_PAYMENT_CENTS);
  });
}

function registerDiscountHappyPath(): void {
  databaseIt("applies a discount adjustment without storing waived status", async () => {
    const fixture = await createOrderFixture();
    const installment = await db.installment.findUniqueOrThrow({
      where: { id: fixture.installmentId },
      select: { amountCents: true },
    });

    const result = await caller().finance.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "DISCOUNT",
      amountCents: DISCOUNT_AMOUNT_CENTS,
      reason: DISCOUNT_REASON,
    });

    assert.equal(result.adjustment.type, "DISCOUNT");
    assert.equal(result.adjustment.amountCents, DISCOUNT_AMOUNT_CENTS);
    assert.equal(result.adjustment.reason, DISCOUNT_REASON);
    assert.notEqual(result.ledger.status, "WAIVED");
    assert.equal(
      result.ledger.currentExpectedCents,
      installment.amountCents + DISCOUNT_AMOUNT_CENTS,
    );

    const stored = await db.installmentAdjustment.findMany({
      where: { installmentId: fixture.installmentId },
    });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.createdById, ADMIN.id);
  });
}

function registerAdjustmentGuards(): void {
  databaseIt("rejects positive discount amounts", async () => {
    const fixture = await createOrderFixture();

    await expectRejects(
      caller().finance.addInstallmentAdjustment({
        installmentId: fixture.installmentId,
        type: "DISCOUNT",
        amountCents: 1000,
        reason: DISCOUNT_REASON,
      }),
      INVALID_ADJUSTMENT_SIGN_MESSAGE,
    );
  });

  databaseIt("rejects discounts without a reason", async () => {
    const fixture = await createOrderFixture();

    await expectRejects(
      caller().finance.addInstallmentAdjustment({
        installmentId: fixture.installmentId,
        type: "DISCOUNT",
        amountCents: DISCOUNT_AMOUNT_CENTS,
      }),
      DISCOUNT_REASON_REQUIRED_MESSAGE,
    );
  });

  databaseIt("rejects adjustments that would drop expected below paid amount", async () => {
    const fixture = await createOrderFixture();
    const paymentEntry = await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: PAYMENT_DATE,
        amountCents: PARTIAL_PAYMENT_CENTS,
        method: PaymentMethod.PIX,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentEntryId: paymentEntry.id,
        installmentId: fixture.installmentId,
        amountCents: PARTIAL_PAYMENT_CENTS,
      },
    });

    await expectRejects(
      caller().finance.addInstallmentAdjustment({
        installmentId: fixture.installmentId,
        type: "DISCOUNT",
        amountCents: -25_000,
        reason: DISCOUNT_REASON,
      }),
      ADJUSTMENT_BELOW_PAID_MESSAGE,
    );
  });

  databaseIt("rejects adjustments on waived installments", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    await expectRejects(
      caller().finance.addInstallmentAdjustment({
        installmentId: fixture.installmentId,
        type: "DISCOUNT",
        amountCents: DISCOUNT_AMOUNT_CENTS,
        reason: DISCOUNT_REASON,
      }),
      WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
    );
  });

  databaseIt("rejects adjustments on cancelled orders", async () => {
    const fixture = await createOrderFixture();
    await db.order.update({
      where: { id: fixture.orderId },
      data: { cancelledAt: new Date(), cancelledReason: "Cliente desistiu" },
    });

    await expectRejects(
      caller().finance.addInstallmentAdjustment({
        installmentId: fixture.installmentId,
        type: "INTEREST",
        amountCents: INTEREST_AMOUNT_CENTS,
      }),
      CANCELLED_ORDER_INSTALLMENT_MESSAGE,
    );
  });
}

function registerOtherAdjustmentTypes(): void {
  databaseIt("persists interest adjustments with positive amounts", async () => {
    const fixture = await createOrderFixture();
    const installment = await db.installment.findUniqueOrThrow({
      where: { id: fixture.installmentId },
      select: { amountCents: true },
    });

    const result = await caller().finance.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "INTEREST",
      amountCents: INTEREST_AMOUNT_CENTS,
    });

    assert.equal(result.adjustment.type, "INTEREST");
    assert.equal(result.ledger.currentExpectedCents, installment.amountCents + INTEREST_AMOUNT_CENTS);
  });

  databaseIt("persists correction adjustments with negative amounts", async () => {
    const fixture = await createOrderFixture();
    const installment = await db.installment.findUniqueOrThrow({
      where: { id: fixture.installmentId },
      select: { amountCents: true },
    });

    const result = await caller().finance.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "CORRECTION",
      amountCents: CORRECTION_AMOUNT_CENTS,
    });

    assert.equal(result.adjustment.type, "CORRECTION");
    assert.equal(
      result.ledger.currentExpectedCents,
      installment.amountCents + CORRECTION_AMOUNT_CENTS,
    );
  });
}

function registerOrderEditCutoffAfterMutation(): void {
  databaseIt("locks the order after a waiver via the public endpoint", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    await expectRejects(updateOrderFixture(fixture), ORDER_LOCKED_MESSAGE);
  });

  databaseIt("locks the order after a discount via the public endpoint", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "DISCOUNT",
      amountCents: DISCOUNT_AMOUNT_CENTS,
      reason: DISCOUNT_REASON,
    });

    await expectRejects(updateOrderFixture(fixture), ORDER_LOCKED_MESSAGE);
  });
}

async function createOrderFixture(): Promise<{
  orderId: string;
  payerId: string;
  studentId: string;
  installmentId: string;
}> {
  const payer = await createPayer("Waiver Payer", WAIVER_TEST_PREFIX);
  const student = await createStudent("Waiver Student", WAIVER_TEST_PREFIX);
  const result = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [student.id],
  });

  return {
    orderId: result.order.id,
    payerId: payer.id,
    studentId: student.id,
    installmentId: result.installments[0]?.id ?? "",
  };
}

async function updateOrderFixture(fixture: { orderId: string; studentId: string }): Promise<unknown> {
  return caller().finance.updateOrder({
    orderId: fixture.orderId,
    kind: "TUITION",
    beneficiaryStudentIds: [fixture.studentId],
    principalAmountCents: LOCKED_UPDATE_PRINCIPAL_CENTS,
    installmentCount: TWO_INSTALLMENTS,
    startDate: LOCKED_UPDATE_START_DATE,
    dueDay: FINANCE_DUE_DAY_FIFTEENTH,
  });
}
