import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";
import {
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";

void it("separates payment date from due month and reconciles partial, waived and cancelled balances", async () => {
  await ensureAdminUser();
  try {
    const fixture = await createInstallmentOrder({
      installmentCount: 4,
      dueDate: "2094-01-31",
      amountCents: 10_000,
    });
    const [partial, waived, deleted, future] = fixture.installmentIds;
    assert.ok(partial && waived && deleted && future);
    await db.installment.update({
      where: { id: waived },
      data: { waivedAt: new Date(), waivedReason: "Isenção de teste" },
    });
    await db.installment.update({ where: { id: deleted }, data: { deletedAt: new Date() } });
    await db.installment.update({
      where: { id: future },
      data: { dueDate: new Date("2094-03-10") },
    });
    await db.installmentAdjustment.create({
      data: { installmentId: partial, type: "DISCOUNT", amountCents: -1000, reason: "Acordo" },
    });
    const payment = await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: new Date("2094-02-01"),
        amountCents: 5000,
        method: "PIX",
      },
    });
    await db.paymentAllocation.create({
      data: { paymentEntryId: payment.id, installmentId: partial, amountCents: 4000 },
    });
    await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: new Date("2094-02-02"),
        amountCents: 9000,
        method: "CASH",
      },
    });
    await db.paymentEntry.create({
      data: {
        payerId: fixture.payerId,
        date: new Date("2094-01-20"),
        amountCents: 7000,
        method: "CARD",
        deletedAt: new Date(),
      },
    });
    const cancelled = await createInstallmentOrder({ dueDate: "2094-01-10" });
    await db.order.update({
      where: { id: cancelled.orderId },
      data: { cancelledAt: new Date(), cancelledReason: "Cancelamento de teste" },
    });
    const result = await finance(db, ADMIN.id).analytics({
      year: 2094,
      now: new Date("2094-02-02T02:30:00Z"),
    });
    assert.equal(result.asOf, "2094-02-01");
    assert.equal(result.months.length, 12);
    assert.equal(result.receivedCents, 5000);
    assert.equal(result.expectedCents, 19_000);
    assert.equal(result.months[0]?.receivedCents, 0);
    assert.equal(result.months[0]?.expectedCents, 9000);
    assert.equal(result.months[0]?.balanceCents, 5000);
    assert.equal(result.months[1]?.receivedCents, 5000);
    assert.equal(result.maturedCents, 9000);
    assert.equal(result.settledMaturedCents, 4000);
    assert.equal(result.overdueCents, 5000);
    assert.equal(result.overduePayers, 1);
    assert.equal(result.months[2]?.expectedCents, 10_000);
    assert.equal(result.months[2]?.balanceCents, 10_000);
    const nextYear = await finance(db, ADMIN.id).analytics({
      year: 2095,
      now: new Date("2094-02-02T02:30:00Z"),
    });
    assert.equal(nextYear.receivedCents, 0);
    assert.equal(nextYear.expectedCents, 0);
    assert.equal(nextYear.maturedCents, 0);
    assert.equal(nextYear.overdueCents, 5000);
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});
