import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { deriveInstallmentLedgers } from "@lazuli/domain";
import { studentOverdueTotals } from "../../src/finance/internal/student-balances.js";
import {
  createFinancialRulesFixture,
  createInstallmentOrder,
  cleanInstallmentsTestData,
  INSTALLMENTS_PREFIX,
} from "../support/finance-installments-test-support.js";

const now = new Date("2026-03-01T02:30:00Z"); // February 28 in São Paulo.
beforeEach(cleanInstallmentsTestData);
after(async () => {
  await cleanInstallmentsTestData();
  await db.$disconnect();
});

void it("aggregates adjusted orders in parity with the pure ledger while keeping due-today, settled and empty orders", async () => {
  const fixture = await createFinancialRulesFixture();
  const [studentId] = fixture.studentIds;
  assert.ok(studentId);
  const sibling = await db.student.create({
    data: { fullName: `${INSTALLMENTS_PREFIX}Sibling balances` },
  });
  const future = await createInstallmentOrder({ dueDate: "2026-04-01" });
  const empty = await createInstallmentOrder();
  await db.installment.deleteMany({ where: { orderId: empty.orderId } });
  const none = await db.student.create({ data: { fullName: `${INSTALLMENTS_PREFIX}No balances` } });
  const values = {
    studentIds: [
      studentId,
      sibling.id,
      future.studentIds[0]!,
      empty.studentIds[0]!,
      none.id,
      studentId,
    ],
    now,
  };
  const today = await studentOverdueTotals({ database: db, values });
  assert.deepEqual(
    today.map((row) => row.overdueCents),
    [0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(
    today.map((row) => row.hasActiveOrder),
    [true, false, true, true, false, true],
  );
  const tomorrow = new Date("2026-03-01T03:00:00Z");
  const installments = await db.installment.findMany({
    where: { orderId: fixture.orderId },
    select: {
      amountCents: true,
      dueDate: true,
      waivedAt: true,
      adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
      allocations: {
        where: { deletedAt: null, paymentEntry: { deletedAt: null } },
        select: { amountCents: true },
      },
    },
  });
  const ledgers = deriveInstallmentLedgers({
    now: tomorrow,
    installments: installments.map((row) => ({ ...row, orderCancelledAt: null })),
  });
  const expected = ledgers.reduce(
    (sum, row) => sum + (row.status === "OVERDUE" ? row.collectibleRemainingCents : 0),
    0,
  );
  assert.equal(expected, 6000);
  const result = await db.$transaction((transaction) =>
    studentOverdueTotals({ database: transaction, values: { ...values, now: tomorrow } }),
  );
  assert.deepEqual(
    result.map((row) => row.overdueCents),
    [expected, 0, 0, 0, 0, expected],
  );
});

void it("excludes deleted monetary facts and visibility scopes without multiplying adjustments by payments", async () => {
  const fixture = await createFinancialRulesFixture();
  const studentId = fixture.studentIds[0]!;
  const values = { studentIds: [studentId], now: new Date("2026-03-02T15:00:00Z") };
  const read = async () => (await studentOverdueTotals({ database: db, values }))[0]!;
  assert.equal((await read()).overdueCents, 6000);
  await db.installmentAdjustment.updateMany({
    where: { installmentId: fixture.partialId, amountCents: -400 },
    data: { deletedAt: now },
  });
  assert.equal((await read()).overdueCents, 6400);
  const allocation = await db.paymentAllocation.findFirstOrThrow({
    where: { installmentId: fixture.partialId },
    orderBy: { amountCents: "asc" },
  });
  await db.paymentEntry.update({
    where: { id: allocation.paymentEntryId },
    data: { deletedAt: now },
  });
  assert.equal((await read()).overdueCents, 6400 + allocation.amountCents);
  await db.paymentEntry.update({
    where: { id: allocation.paymentEntryId },
    data: { deletedAt: null },
  });
  await db.paymentAllocation.update({ where: { id: allocation.id }, data: { deletedAt: now } });
  assert.equal((await read()).overdueCents, 6400 + allocation.amountCents);
  await db.installment.update({ where: { id: fixture.partialId }, data: { deletedAt: now } });
  assert.deepEqual(await read(), { studentId, hasActiveOrder: true, overdueCents: 0 });
  await db.order.update({
    where: { id: fixture.orderId },
    data: { cancelledAt: now, cancelledReason: "Cancelamento de teste" },
  });
  assert.deepEqual(await read(), { studentId, hasActiveOrder: false, overdueCents: 0 });
  await db.order.update({
    where: { id: fixture.orderId },
    data: { cancelledAt: null, cancelledReason: null, deletedAt: now },
  });
  assert.equal((await read()).hasActiveOrder, false);
  await db.order.update({ where: { id: fixture.orderId }, data: { deletedAt: null } });
  await db.orderBeneficiary.updateMany({
    where: { orderId: fixture.orderId },
    data: { deletedAt: now },
  });
  assert.equal((await read()).hasActiveOrder, false);
  await db.orderBeneficiary.updateMany({
    where: { orderId: fixture.orderId },
    data: { deletedAt: null },
  });
  await db.student.update({ where: { id: studentId }, data: { deletedAt: now } });
  assert.equal((await read()).hasActiveOrder, false);
});
