import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db, InstallmentAdjustmentType, PaymentMethod } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ENTRY_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_PAYER_MISMATCH_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
} from "../../src/finance/index.js";
import {
  caller,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
  expectRejects,
} from "../support/finance-test-support.js";

const PAYMENT_DATE = new Date("2026-04-10T00:00:00.000Z");
const ORDER_START_DATE = new Date("2026-04-01T00:00:00.000Z");
const ORDER_PRINCIPAL_CENTS = 60_000;
const PAYMENT_TEST_PREFIX = "GRE-44 ";
const PAYMENT_ENTRY_AMOUNT_CENTS = 55_000;
const FIRST_ALLOCATION_CENTS = 20_000;
const SECOND_ALLOCATION_CENTS = 30_000;
const UNALLOCATED_REMAINDER_CENTS = 5000;
const SMALL_PAYMENT_CENTS = 10_000;
const OVERPAYMENT_ALLOCATION_CENTS = 10_001;
const EXISTING_PAYMENT_CENTS = 20_000;
const DISCOUNT_AMOUNT_CENTS = -5000;
const BALANCE_PLUS_ONE_CENTS = 5001;
const CONCURRENT_ALLOCATION_CENTS = 20_000;
const TWO_INSTALLMENTS = 2;
const MISSING_ENTITY_ID = "00000000-0000-0000-0000-000000000099";

void describe("finance.registerPayment", () => {
  registerFinancePaymentHooks();
  registerPaymentHappyPath();
  registerMissingPayerError();
  registerMissingInstallmentError();
  registerCrossPayerError();
  registerEntryOverAllocationError();
  registerInstallmentOverAllocationError();
  registerWaivedInstallmentError();
  registerConcurrentAllocationBehavior();
});

function registerFinancePaymentHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(PAYMENT_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(PAYMENT_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerPaymentHappyPath(): void {
  databaseIt(
    "registers one payment across installments from multiple orders for the same payer",
    async () => {
      const payer = await createPayer("Payment Payer", PAYMENT_TEST_PREFIX);
      const firstOrder = await createOrderFixture({
        payerId: payer.id,
        studentSuffix: "Payment Student A",
      });
      const secondOrder = await createOrderFixture({
        payerId: payer.id,
        studentSuffix: "Payment Student B",
      });

      const result = await caller().finance.registerPayment({
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: PAYMENT_ENTRY_AMOUNT_CENTS,
        method: "PIX",
        note: "Pagamento parcial",
        externalReference: "GRE-44-PIX-1",
        allocations: [
          {
            installmentId: firstOrder.installmentIds[0] ?? "",
            amountCents: FIRST_ALLOCATION_CENTS,
          },
          {
            installmentId: secondOrder.installmentIds[0] ?? "",
            amountCents: SECOND_ALLOCATION_CENTS,
          },
        ],
      });

      assert.equal(result.paymentEntry.payerId, payer.id);
      assert.equal(result.paymentEntry.amountCents, PAYMENT_ENTRY_AMOUNT_CENTS);
      assert.equal(result.allocations.length, 2);
      assert.equal(result.unallocatedRemainderCents, UNALLOCATED_REMAINDER_CENTS);

      const storedEntry = await db.paymentEntry.findUniqueOrThrow({
        where: { id: result.paymentEntry.id },
        include: { allocations: true },
      });
      assert.equal(storedEntry.createdById, "00000000-0000-0000-0000-0000000000ad");
      const storedAmounts = new Set(storedEntry.allocations.map((row) => row.amountCents));
      assert.equal(storedAmounts.has(FIRST_ALLOCATION_CENTS), true);
      assert.equal(storedAmounts.has(SECOND_ALLOCATION_CENTS), true);
    },
  );
}

function registerMissingPayerError(): void {
  databaseIt("rejects missing payers", async () => {
    const payer = await createPayer("Missing Payment Payer", PAYMENT_TEST_PREFIX);
    const order = await createOrderFixture({
      payerId: payer.id,
      studentSuffix: "Missing Payment Student",
    });

    await expectRejects(
      caller().finance.registerPayment({
        payerId: MISSING_ENTITY_ID,
        date: PAYMENT_DATE,
        amountCents: SMALL_PAYMENT_CENTS,
        method: "PIX",
        allocations: [
          { installmentId: order.installmentIds[0] ?? "", amountCents: SMALL_PAYMENT_CENTS },
        ],
      }),
      PAYER_NOT_FOUND_MESSAGE,
    );
  });
}

function registerMissingInstallmentError(): void {
  databaseIt("rejects missing installments", async () => {
    const payer = await createPayer("Missing Installment Payer", PAYMENT_TEST_PREFIX);

    await expectRejects(
      caller().finance.registerPayment({
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: SMALL_PAYMENT_CENTS,
        method: "PIX",
        allocations: [{ installmentId: MISSING_ENTITY_ID, amountCents: SMALL_PAYMENT_CENTS }],
      }),
      INSTALLMENT_NOT_FOUND_MESSAGE,
    );
  });
}

function registerCrossPayerError(): void {
  databaseIt("rejects allocations to installments owned by another payer", async () => {
    const payer = await createPayer("Cross Payer A", PAYMENT_TEST_PREFIX);
    const otherPayer = await createPayer("Cross Payer B", PAYMENT_TEST_PREFIX);
    const otherOrder = await createOrderFixture({
      payerId: otherPayer.id,
      studentSuffix: "Cross Payer Student",
    });

    await expectRejects(
      caller().finance.registerPayment({
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: SMALL_PAYMENT_CENTS,
        method: "PIX",
        allocations: [
          { installmentId: otherOrder.installmentIds[0] ?? "", amountCents: SMALL_PAYMENT_CENTS },
        ],
      }),
      INSTALLMENT_PAYER_MISMATCH_MESSAGE,
    );
  });
}

function registerEntryOverAllocationError(): void {
  databaseIt("rejects allocations whose total exceeds the payment amount", async () => {
    const payer = await createPayer("Entry Over Payer", PAYMENT_TEST_PREFIX);
    const order = await createOrderFixture({
      payerId: payer.id,
      studentSuffix: "Entry Over Student",
    });

    await expectRejects(
      caller().finance.registerPayment({
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: SMALL_PAYMENT_CENTS,
        method: "PIX",
        allocations: [
          {
            installmentId: order.installmentIds[0] ?? "",
            amountCents: OVERPAYMENT_ALLOCATION_CENTS,
          },
        ],
      }),
      ENTRY_OVER_ALLOCATION_MESSAGE,
    );
  });
}

function registerInstallmentOverAllocationError(): void {
  databaseIt(
    "rejects allocation beyond the installment balance after adjustments and payments",
    async () => {
      const payer = await createPayer("Installment Over Payer", PAYMENT_TEST_PREFIX);
      const order = await createOrderFixture({
        payerId: payer.id,
        studentSuffix: "Installment Over Student",
      });
      const installmentId = order.installmentIds[0] ?? "";
      const existingPayment = await db.paymentEntry.create({
        data: {
          payerId: payer.id,
          date: PAYMENT_DATE,
          amountCents: EXISTING_PAYMENT_CENTS,
          method: PaymentMethod.PIX,
        },
      });
      await db.paymentAllocation.create({
        data: {
          paymentEntryId: existingPayment.id,
          installmentId,
          amountCents: EXISTING_PAYMENT_CENTS,
        },
      });
      await db.installmentAdjustment.create({
        data: {
          installmentId,
          type: InstallmentAdjustmentType.DISCOUNT,
          amountCents: DISCOUNT_AMOUNT_CENTS,
          reason: "Desconto",
        },
      });

      await expectRejects(
        caller().finance.registerPayment({
          payerId: payer.id,
          date: PAYMENT_DATE,
          amountCents: BALANCE_PLUS_ONE_CENTS,
          method: "PIX",
          allocations: [{ installmentId, amountCents: BALANCE_PLUS_ONE_CENTS }],
        }),
        INSTALLMENT_OVER_ALLOCATION_MESSAGE,
      );
    },
  );
}

function registerWaivedInstallmentError(): void {
  databaseIt("rejects allocations to waived installments", async () => {
    const payer = await createPayer("Waived Payer", PAYMENT_TEST_PREFIX);
    const order = await createOrderFixture({ payerId: payer.id, studentSuffix: "Waived Student" });
    const installmentId = order.installmentIds[0] ?? "";
    await db.installment.update({
      where: { id: installmentId },
      data: { waivedAt: new Date(), waivedReason: "Bolsa" },
    });

    await expectRejects(
      caller().finance.registerPayment({
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: SMALL_PAYMENT_CENTS,
        method: "PIX",
        allocations: [{ installmentId, amountCents: SMALL_PAYMENT_CENTS }],
      }),
      WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
    );
  });
}

function registerConcurrentAllocationBehavior(): void {
  databaseIt(
    "serializes concurrent allocations so persisted totals never exceed the balance",
    async () => {
      const payer = await createPayer("Concurrent Payer", PAYMENT_TEST_PREFIX);
      const order = await createOrderFixture({
        payerId: payer.id,
        studentSuffix: "Concurrent Student",
      });
      const installmentId = order.installmentIds[0] ?? "";
      const input = {
        payerId: payer.id,
        date: PAYMENT_DATE,
        amountCents: CONCURRENT_ALLOCATION_CENTS,
        method: "PIX" as const,
        allocations: [{ installmentId, amountCents: CONCURRENT_ALLOCATION_CENTS }],
      };

      const outcomes = await Promise.allSettled([
        caller().finance.registerPayment({ ...input, externalReference: "GRE-44-CONCURRENT-1" }),
        caller().finance.registerPayment({ ...input, externalReference: "GRE-44-CONCURRENT-2" }),
      ]);

      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
      const rejected = outcomes.find((outcome) => outcome.status === "rejected");
      assert.ok(rejected?.status === "rejected");
      assert.ok(rejected.reason instanceof Error);
      assert.ok(rejected.reason.message.includes(INSTALLMENT_OVER_ALLOCATION_MESSAGE));

      const persisted = await db.paymentAllocation.findMany({ where: { installmentId } });
      const persistedTotal = persisted.reduce((total, row) => total + row.amountCents, 0);
      assert.equal(persistedTotal, CONCURRENT_ALLOCATION_CENTS);
    },
  );
}

async function createOrderFixture(input: {
  payerId: string;
  studentSuffix: string;
}): Promise<{ installmentIds: string[] }> {
  const student = await createStudent(input.studentSuffix, PAYMENT_TEST_PREFIX);
  const result = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    payer: { mode: "existing", payerId: input.payerId },
    beneficiaryStudentIds: [student.id],
    principalAmountCents: ORDER_PRINCIPAL_CENTS,
    installmentCount: TWO_INSTALLMENTS,
    startDate: ORDER_START_DATE,
  });

  return { installmentIds: result.installments.map((installment) => installment.id) };
}
