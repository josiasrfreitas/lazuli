import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db, InstallmentAdjustmentType, PaymentMethod } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  caller,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
} from "../support/finance-test-support.js";

const BATCH_TEST_PREFIX = "GRE-46 ";
const RECONCILE_DATE = new Date("2026-04-15T00:00:00.000Z");
const ORDER_START_DATE = new Date("2026-04-01T00:00:00.000Z");
const ORDER_PRINCIPAL_CENTS = 60_000;
const TWO_INSTALLMENTS = 2;
const INSTALLMENT_AMOUNT_CENTS = 30_000;
const EXISTING_PAYMENT_CENTS = 10_000;
const DISCOUNT_AMOUNT_CENTS = -5000;
const DISCOUNTED_REMAINING_CENTS = 15_000;
const MISSING_ENTITY_ID = "00000000-0000-0000-0000-000000000046";
const HAPPY_PATH_EXTERNAL_REFERENCE = "GRE-46-CORA-1";

void describe("finance.batchReconcile", () => {
  registerFinanceBatchReconcileHooks();
  registerBatchReconcileHappyPath();
  registerBatchReconcileAtomicFailure();
  registerBatchReconcileConcurrency();
  registerBatchReconcileDuplicateFailure();
});

function registerFinanceBatchReconcileHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(BATCH_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(BATCH_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerBatchReconcileHappyPath(): void {
  databaseIt("creates one payment entry per payer and full remaining allocations", async () => {
    const fixture = await createHappyPathFixture();

    const result = await caller().finance.batchReconcile({
      date: RECONCILE_DATE,
      method: "PIX",
      externalReference: HAPPY_PATH_EXTERNAL_REFERENCE,
      installmentIds: [fixture.fullInstallmentId, fixture.discountedInstallmentId],
    });

    assertHappyPathResponse(result, fixture);
    await assertHappyPathStoredEntries();
  });
}

async function createHappyPathFixture(): Promise<{
  firstPayerId: string;
  secondPayerId: string;
  discountedInstallmentId: string;
  fullInstallmentId: string;
}> {
  const firstPayer = await createPayer("Batch Payer A", BATCH_TEST_PREFIX);
  const secondPayer = await createPayer("Batch Payer B", BATCH_TEST_PREFIX);
  const firstOrder = await createOrderFixture({
    payerId: firstPayer.id,
    studentSuffix: "Batch Student A",
  });
  const secondOrder = await createOrderFixture({
    payerId: secondPayer.id,
    studentSuffix: "Batch Student B",
  });
  const discountedInstallmentId = firstOrder.installmentIds[0] ?? "";
  const fullInstallmentId = secondOrder.installmentIds[0] ?? "";

  await createExistingPaymentAllocation({
    payerId: firstPayer.id,
    installmentId: discountedInstallmentId,
  });
  await createDiscountAdjustment(discountedInstallmentId);

  return {
    firstPayerId: firstPayer.id,
    secondPayerId: secondPayer.id,
    discountedInstallmentId,
    fullInstallmentId,
  };
}

function assertHappyPathResponse(
  result: Awaited<ReturnType<ReturnType<typeof caller>["finance"]["batchReconcile"]>>,
  fixture: {
    firstPayerId: string;
    secondPayerId: string;
    discountedInstallmentId: string;
    fullInstallmentId: string;
  },
): void {
  const expectedPayerIds =
    fixture.firstPayerId < fixture.secondPayerId
      ? [fixture.firstPayerId, fixture.secondPayerId]
      : [fixture.secondPayerId, fixture.firstPayerId];

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.rows.map((row) => row.installmentId),
    [fixture.fullInstallmentId, fixture.discountedInstallmentId],
  );
  assert.deepEqual(
    result.rows.map((row) => row.status),
    ["APPLIED", "APPLIED"],
  );
  assert.deepEqual(
    result.paymentEntries.map((entry) => entry.payerId),
    expectedPayerIds,
  );
  assert.equal(result.paymentEntries.length, 2);
  assert.equal(result.allocations.length, 2);
  assert.equal(
    result.paymentEntries.every(
      (entry) => entry.externalReference === HAPPY_PATH_EXTERNAL_REFERENCE,
    ),
    true,
  );

  const allocationAmounts = new Map(
    result.allocations.map((allocation) => [allocation.installmentId, allocation.amountCents]),
  );
  assert.equal(allocationAmounts.get(fixture.discountedInstallmentId), DISCOUNTED_REMAINING_CENTS);
  assert.equal(allocationAmounts.get(fixture.fullInstallmentId), INSTALLMENT_AMOUNT_CENTS);
}

async function assertHappyPathStoredEntries(): Promise<void> {
  const storedEntries = await db.paymentEntry.findMany({
    where: { externalReference: HAPPY_PATH_EXTERNAL_REFERENCE },
    include: { allocations: true },
    orderBy: { payerId: "asc" },
  });
  assert.equal(storedEntries.length, 2);
  assert.deepEqual(
    storedEntries.map((entry) => entry.allocations.length),
    [1, 1],
  );
}

async function createDiscountAdjustment(installmentId: string): Promise<void> {
  await db.installmentAdjustment.create({
    data: {
      installmentId,
      type: InstallmentAdjustmentType.DISCOUNT,
      amountCents: DISCOUNT_AMOUNT_CENTS,
      reason: "Desconto",
    },
  });
}

function registerBatchReconcileAtomicFailure(): void {
  databaseIt("rejects an invalid batch without persisting entries or allocations", async () => {
    const payer = await createPayer("Atomic Payer", BATCH_TEST_PREFIX);
    const order = await createOrderFixture({
      payerId: payer.id,
      studentSuffix: "Atomic Student",
    });
    const validInstallmentId = order.installmentIds[0] ?? "";

    const result = await caller().finance.batchReconcile({
      date: RECONCILE_DATE,
      method: "PIX",
      externalReference: "GRE-46-ATOMIC",
      installmentIds: [validInstallmentId, MISSING_ENTITY_ID],
    });

    assert.equal(result.ok, false);
    assert.equal(result.paymentEntries.length, 0);
    assert.equal(result.allocations.length, 0);
    assert.deepEqual(
      result.rows.map((row) => row.status),
      ["SKIPPED", "REJECTED"],
    );

    const persistedEntries = await db.paymentEntry.count({
      where: { externalReference: "GRE-46-ATOMIC" },
    });
    const persistedAllocations = await db.paymentAllocation.count({
      where: { installmentId: validInstallmentId },
    });
    assert.equal(persistedEntries, 0);
    assert.equal(persistedAllocations, 0);
  });
}

function registerBatchReconcileConcurrency(): void {
  databaseIt("serializes concurrent reconciles so only one allocation persists", async () => {
    const payer = await createPayer("Concurrent Batch Payer", BATCH_TEST_PREFIX);
    const order = await createOrderFixture({
      payerId: payer.id,
      studentSuffix: "Concurrent Batch Student",
    });
    const installmentId = order.installmentIds[0] ?? "";
    const input = {
      date: RECONCILE_DATE,
      method: "PIX" as const,
      installmentIds: [installmentId],
    };

    const results = await Promise.all([
      caller().finance.batchReconcile({ ...input, externalReference: "GRE-46-CONCURRENT-1" }),
      caller().finance.batchReconcile({ ...input, externalReference: "GRE-46-CONCURRENT-2" }),
    ]);

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    const rejected = results.find((result) => !result.ok);
    assert.deepEqual(
      rejected?.rows.map((row) => row.status),
      ["REJECTED"],
    );

    const persisted = await db.paymentAllocation.findMany({ where: { installmentId } });
    const persistedTotal = persisted.reduce((total, row) => total + row.amountCents, 0);
    assert.equal(persisted.length, 1);
    assert.equal(persistedTotal, INSTALLMENT_AMOUNT_CENTS);
  });
}

function registerBatchReconcileDuplicateFailure(): void {
  databaseIt("rejects duplicate selected installments without writes", async () => {
    const payer = await createPayer("Duplicate Batch Payer", BATCH_TEST_PREFIX);
    const order = await createOrderFixture({
      payerId: payer.id,
      studentSuffix: "Duplicate Batch Student",
    });
    const installmentId = order.installmentIds[0] ?? "";

    const result = await caller().finance.batchReconcile({
      date: RECONCILE_DATE,
      method: "PIX",
      externalReference: "GRE-46-DUPLICATE",
      installmentIds: [installmentId, installmentId],
    });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.rows.map((row) => row.status),
      ["REJECTED", "REJECTED"],
    );

    const persistedEntries = await db.paymentEntry.count({
      where: { externalReference: "GRE-46-DUPLICATE" },
    });
    const persistedAllocations = await db.paymentAllocation.count({
      where: { installmentId },
    });
    assert.equal(persistedEntries, 0);
    assert.equal(persistedAllocations, 0);
  });
}

async function createOrderFixture(input: {
  payerId: string;
  studentSuffix: string;
}): Promise<{ installmentIds: string[] }> {
  const student = await createStudent(input.studentSuffix, BATCH_TEST_PREFIX);
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

async function createExistingPaymentAllocation(input: {
  payerId: string;
  installmentId: string;
}): Promise<void> {
  const existingPayment = await db.paymentEntry.create({
    data: {
      payerId: input.payerId,
      date: RECONCILE_DATE,
      amountCents: EXISTING_PAYMENT_CENTS,
      method: PaymentMethod.PIX,
    },
  });
  await db.paymentAllocation.create({
    data: {
      paymentEntryId: existingPayment.id,
      installmentId: input.installmentId,
      amountCents: EXISTING_PAYMENT_CENTS,
    },
  });
}
