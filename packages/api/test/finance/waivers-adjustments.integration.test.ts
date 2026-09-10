import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

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
} from "../../src/finance/index.js";
import {
  ADMIN,
  caller,
  cleanFinanceOrdersDatabase,
  ensureAdminUser,
  rejectionMessage,
} from "../support/finance-test-support.js";
import {
  allocatePaymentToInstallment,
  cancelOrder,
  CORRECTION_AMOUNT_CENTS,
  createOrderFixture,
  DISCOUNT_AMOUNT_CENTS,
  DISCOUNT_REASON,
  FULL_INSTALLMENT_PAYMENT_CENTS,
  INTEREST_AMOUNT_CENTS,
  MISSING_ENTITY_ID,
  PARTIAL_PAYMENT_CENTS,
  updateOrderFixture,
  WAIVER_REASON,
  WAIVER_TEST_PREFIX,
} from "../support/finance-waivers-adjustments-test-support.js";

void describe("finance.waiveInstallment", () => {
  registerWaiverHooks();
  registerWaiveHappyPath();
  registerWaiveFullyPaidGuard();
  registerWaiveAlreadyWaivedGuard();
  registerWaiveMissingGuard();
  registerWaiveCancelledOrderGuard();
  registerWaivePreservesPaidRevenue();
});

void describe("finance.addInstallmentAdjustment", () => {
  registerWaiverHooks();
  registerDiscountHappyPath();
  registerDiscountSignGuards();
  registerAdjustmentPaidGuard();
  registerAdjustmentWaivedGuard();
  registerAdjustmentCancelledGuard();
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
  void it("marks an installment waived and derives non-collectible status", async () => {
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
    assert.equal(stored.sequenceNumber, 1);
    assert.equal(stored.updatedById, ADMIN.id);
  });
}

function registerWaiveFullyPaidGuard(): void {
  void it("rejects waiving a fully paid installment", async () => {
    const fixture = await createOrderFixture();
    await allocatePaymentToInstallment({
      payerId: fixture.payerId,
      installmentId: fixture.installmentId,
      amountCents: FULL_INSTALLMENT_PAYMENT_CENTS,
    });

    assert.equal(
      await rejectionMessage(
        caller().finance.waiveInstallment({
          installmentId: fixture.installmentId,
          reason: WAIVER_REASON,
        }),
      ),
      INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE,
    );
  });
}

function registerWaiveAlreadyWaivedGuard(): void {
  void it("rejects waiving an already waived installment", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    assert.equal(
      await rejectionMessage(
        caller().finance.waiveInstallment({
          installmentId: fixture.installmentId,
          reason: "Segunda tentativa",
        }),
      ),
      INSTALLMENT_ALREADY_WAIVED_MESSAGE,
    );
  });
}

function registerWaiveMissingGuard(): void {
  void it("rejects waiving a missing installment", async () => {
    assert.equal(
      await rejectionMessage(
        caller().finance.waiveInstallment({
          installmentId: MISSING_ENTITY_ID,
          reason: WAIVER_REASON,
        }),
      ),
      INSTALLMENT_NOT_FOUND_MESSAGE,
    );
  });
}

function registerWaiveCancelledOrderGuard(): void {
  void it("rejects waiving installments on cancelled orders", async () => {
    const fixture = await createOrderFixture();
    await cancelOrder(fixture.orderId);

    assert.equal(
      await rejectionMessage(
        caller().finance.waiveInstallment({
          installmentId: fixture.installmentId,
          reason: WAIVER_REASON,
        }),
      ),
      CANCELLED_ORDER_INSTALLMENT_MESSAGE,
    );
  });
}

function registerWaivePreservesPaidRevenue(): void {
  void it("forgives only the remaining balance after partial payment", async () => {
    const fixture = await createOrderFixture();
    await allocatePaymentToInstallment({
      payerId: fixture.payerId,
      installmentId: fixture.installmentId,
      amountCents: PARTIAL_PAYMENT_CENTS,
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
  void it("applies a discount adjustment without storing waived status", async () => {
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

function registerDiscountSignGuards(): void {
  void it("rejects positive discount amounts", async () => {
    const fixture = await createOrderFixture();

    assert.equal(
      await rejectionMessage(
        caller().finance.addInstallmentAdjustment({
          installmentId: fixture.installmentId,
          type: "DISCOUNT",
          amountCents: 1000,
          reason: DISCOUNT_REASON,
        }),
      ),
      INVALID_ADJUSTMENT_SIGN_MESSAGE,
    );
  });

  void it("rejects discounts without a reason", async () => {
    const fixture = await createOrderFixture();

    assert.equal(
      await rejectionMessage(
        caller().finance.addInstallmentAdjustment({
          installmentId: fixture.installmentId,
          type: "DISCOUNT",
          amountCents: DISCOUNT_AMOUNT_CENTS,
        }),
      ),
      DISCOUNT_REASON_REQUIRED_MESSAGE,
    );
  });
}

function registerAdjustmentPaidGuard(): void {
  void it("rejects adjustments that would drop expected below paid amount", async () => {
    const fixture = await createOrderFixture();
    await allocatePaymentToInstallment({
      payerId: fixture.payerId,
      installmentId: fixture.installmentId,
      amountCents: PARTIAL_PAYMENT_CENTS,
    });

    assert.equal(
      await rejectionMessage(
        caller().finance.addInstallmentAdjustment({
          installmentId: fixture.installmentId,
          type: "DISCOUNT",
          amountCents: -25_000,
          reason: DISCOUNT_REASON,
        }),
      ),
      ADJUSTMENT_BELOW_PAID_MESSAGE,
    );
  });
}

function registerAdjustmentWaivedGuard(): void {
  void it("rejects adjustments on waived installments", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    assert.equal(
      await rejectionMessage(
        caller().finance.addInstallmentAdjustment({
          installmentId: fixture.installmentId,
          type: "DISCOUNT",
          amountCents: DISCOUNT_AMOUNT_CENTS,
          reason: DISCOUNT_REASON,
        }),
      ),
      WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE,
    );
  });
}

function registerAdjustmentCancelledGuard(): void {
  void it("rejects adjustments on cancelled orders", async () => {
    const fixture = await createOrderFixture();
    await cancelOrder(fixture.orderId);

    assert.equal(
      await rejectionMessage(
        caller().finance.addInstallmentAdjustment({
          installmentId: fixture.installmentId,
          type: "INTEREST",
          amountCents: INTEREST_AMOUNT_CENTS,
        }),
      ),
      CANCELLED_ORDER_INSTALLMENT_MESSAGE,
    );
  });
}

function registerOtherAdjustmentTypes(): void {
  void it("persists interest adjustments with positive amounts", async () => {
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
    assert.equal(
      result.ledger.currentExpectedCents,
      installment.amountCents + INTEREST_AMOUNT_CENTS,
    );
  });

  void it("persists correction adjustments with negative amounts", async () => {
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
  void it("locks the order after a waiver via the public endpoint", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.waiveInstallment({
      installmentId: fixture.installmentId,
      reason: WAIVER_REASON,
    });

    assert.equal(await rejectionMessage(updateOrderFixture(fixture)), ORDER_LOCKED_MESSAGE);
  });

  void it("locks the order after a discount via the public endpoint", async () => {
    const fixture = await createOrderFixture();
    await caller().finance.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "DISCOUNT",
      amountCents: DISCOUNT_AMOUNT_CENTS,
      reason: DISCOUNT_REASON,
    });

    assert.equal(await rejectionMessage(updateOrderFixture(fixture)), ORDER_LOCKED_MESSAGE);
  });
}
