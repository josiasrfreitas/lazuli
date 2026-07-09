import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { FINANCE_DUE_DAY_FIFTH } from "@lazuli/domain";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { receivables } from "../../src/receivables/index.js";
import {
  ADMIN,
  cleanFinanceOrdersDatabase,
  createStudent,
  ensureAdminUser,
} from "./finance-test-support.js";
import type { OrderScheduleResult } from "../../src/receivables/index.js";

const PREFIX = "GRE-RCV ";
const INSTALLMENT_COUNT = 3;
const PRINCIPAL_CENTS = 90_000;
const INSTALLMENT_CENTS = 30_000;
const INTEREST_CENTS = 5000;
const PAST_START_DATE = new Date("2020-01-03T00:00:00.000Z");

/**
 * Proves the one-interface win from D-0037: the full create → derive → aggregate
 * receivables flow is driven entirely through `receivables(db, staffUserId)` —
 * no tRPC router, no HTTP boundary. If this can't be written against the module's
 * public surface alone, the module is not deep enough.
 */
void describe("receivables module — end-to-end through one interface", { concurrency: 1 }, () => {
  registerHooks();
  registerFullFlow();
  registerBatchReconcile();
});

function registerHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(PREFIX);
    await db.$disconnect();
  });
}

function registerFullFlow(): void {
  databaseIt(
    "creates payer + order, registers a payment, waives, adjusts, then aggregates",
    async () => {
      const student = await createStudent("beneficiary", PREFIX);
      const baseline = await receivables(db, ADMIN.id).receivablesSnapshot();
      const created = await createPastDueOrder(`${PREFIX}payer`, student.id);
      const [first, second, third] = expectThreeInstallments(created);

      await payInFull(created.order.payerId, first.id);
      await waiveWithBolsa(second.id);
      await addInterest(third.id);

      await assertAggregates({ baseline });
      await assertOverdueRow({
        orderId: created.order.id,
        installmentId: third.id,
        studentId: student.id,
      });
    },
  );
}

function registerBatchReconcile(): void {
  databaseIt("reconciles a batch of installments into one payer payment", async () => {
    const student = await createStudent("batch-beneficiary", PREFIX);
    const created = await createPastDueOrder(`${PREFIX}batch-payer`, student.id);
    const installmentIds = created.installments.map((installment) => installment.id);

    const result = await db.$transaction((tx) =>
      receivables(tx, ADMIN.id).batchReconcile({
        date: new Date(),
        method: "BOLETO",
        installmentIds,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.paymentEntries.length, 1);
    assert.equal(result.paymentEntries[0]?.amountCents, PRINCIPAL_CENTS);
    assert.ok(result.rows.every((row) => row.status === "APPLIED"));
  });
}

async function createPastDueOrder(
  payerName: string,
  studentId: string,
): Promise<OrderScheduleResult> {
  return db.$transaction((tx) =>
    receivables(tx, ADMIN.id).createOrder({
      kind: "TUITION",
      beneficiaryStudentIds: [studentId],
      principalAmountCents: PRINCIPAL_CENTS,
      installmentCount: INSTALLMENT_COUNT,
      startDate: PAST_START_DATE,
      dueDay: FINANCE_DUE_DAY_FIFTH,
      payer: { mode: "create", name: payerName },
    }),
  );
}

function expectThreeInstallments(
  created: OrderScheduleResult,
): [
  OrderScheduleResult["installments"][number],
  OrderScheduleResult["installments"][number],
  OrderScheduleResult["installments"][number],
] {
  assert.equal(created.installments.length, INSTALLMENT_COUNT);
  const [first, second, third] = created.installments;
  assert.ok(first && second && third);
  return [first, second, third];
}

async function payInFull(payerId: string, installmentId: string): Promise<void> {
  const payment = await db.$transaction((tx) =>
    receivables(tx, ADMIN.id).registerPayment({
      payerId,
      date: new Date(),
      amountCents: INSTALLMENT_CENTS,
      method: "PIX",
      allocations: [{ installmentId, amountCents: INSTALLMENT_CENTS }],
    }),
  );
  assert.equal(payment.unallocatedRemainderCents, 0);
}

async function waiveWithBolsa(installmentId: string): Promise<void> {
  const waived = await db.$transaction((tx) =>
    receivables(tx, ADMIN.id).waiveInstallment({ installmentId, reason: `${PREFIX}bolsa` }),
  );
  assert.equal(waived.ledger.status, "WAIVED");
}

async function addInterest(installmentId: string): Promise<void> {
  const adjusted = await db.$transaction((tx) =>
    receivables(tx, ADMIN.id).addInstallmentAdjustment({
      installmentId,
      type: "INTEREST",
      amountCents: INTEREST_CENTS,
    }),
  );
  assert.equal(adjusted.ledger.currentExpectedCents, INSTALLMENT_CENTS + INTEREST_CENTS);
}

async function assertAggregates(input: {
  baseline: Awaited<ReturnType<ReturnType<typeof receivables>["receivablesSnapshot"]>>;
}): Promise<void> {
  const snapshot = await receivables(db, ADMIN.id).receivablesSnapshot();
  // First is fully paid (remaining 0), second is waived (not collectible),
  // third carries 30000 + 5000 interest and is past due.
  assert.equal(
    snapshot.receivedThisMonthCents - input.baseline.receivedThisMonthCents,
    INSTALLMENT_CENTS,
  );
  assert.equal(
    snapshot.overdueCents - input.baseline.overdueCents,
    INSTALLMENT_CENTS + INTEREST_CENTS,
  );
}

async function assertOverdueRow(input: {
  orderId: string;
  installmentId: string;
  studentId: string;
}): Promise<void> {
  const overdue = await receivables(db, ADMIN.id).overdueList();
  const ourRows = overdue.rows.filter((row) => row.orderId === input.orderId);

  assert.equal(ourRows.length, 1);
  assert.equal(ourRows[0]?.installmentId, input.installmentId);
  assert.equal(ourRows[0]?.ledger.status, "OVERDUE");
  assert.equal(ourRows[0]?.ledger.collectibleRemainingCents, INSTALLMENT_CENTS + INTEREST_CENTS);
  assert.equal(ourRows[0]?.beneficiaries[0]?.studentId, input.studentId);
}
