import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";
import {
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";

void it("groups receipts without allocation joins and classifies exact aging boundaries across years", async () => {
  await ensureAdminUser();
  try {
    const initial = await finance(db, ADMIN.id).analytics({
      year: 2094,
      now: new Date("2094-04-02T02:30:00Z"),
    });
    assert.deepEqual(initial.aging, [
      { label: "1–30 dias", balanceCents: 0, count: 0 },
      { label: "31–60 dias", balanceCents: 0, count: 0 },
      { label: "61–90 dias", balanceCents: 0, count: 0 },
      { label: "Mais de 90 dias", balanceCents: 0, count: 0 },
    ]);
    const fixtures = [];
    // On 2094-04-01 these dates are respectively 0/1/30/31/60/61/90/91 days overdue.
    for (const dueDate of [
      "2094-04-01",
      "2094-03-31",
      "2094-03-02",
      "2094-03-01",
      "2094-01-31",
      "2094-01-30",
      "2094-01-01",
      "2093-12-31",
    ]) {
      fixtures.push(await createInstallmentOrder({ dueDate, amountCents: 10_000 }));
    }
    const partial = fixtures[1];
    assert.ok(partial);
    const installmentId = partial.installmentIds[0];
    assert.ok(installmentId);
    const payment = await db.paymentEntry.create({
      data: {
        payerId: partial.payerId,
        date: new Date("2094-03-31"),
        amountCents: 5000,
        method: "PIX",
      },
    });
    await db.paymentAllocation.create({
      data: { paymentEntryId: payment.id, installmentId, amountCents: 4000 },
    });
    await db.paymentEntry.createMany({
      data: [
        {
          payerId: partial.payerId,
          date: new Date("2094-03-20"),
          amountCents: 2000,
          method: "CASH",
        },
        {
          payerId: partial.payerId,
          date: new Date("2094-03-20"),
          amountCents: 7000,
          method: "CARD",
          deletedAt: new Date(),
        },
        {
          payerId: partial.payerId,
          date: new Date("2094-04-02"),
          amountCents: 9000,
          method: "TRANSFER",
        },
      ],
    });
    const result = await finance(db, ADMIN.id).analytics({
      year: 2094,
      now: new Date("2094-04-02T02:30:00Z"),
    });
    assert.equal(result.asOf, "2094-04-01");
    assert.deepEqual(result.methods, [
      { method: "PIX", label: "Pix", receivedCents: 5000, count: 1 },
      { method: "CASH", label: "Dinheiro", receivedCents: 2000, count: 1 },
    ]);
    assert.equal(result.receivedCents, 7000);
    assert.deepEqual(result.aging, [
      { label: "1–30 dias", balanceCents: 16_000, count: 2 },
      { label: "31–60 dias", balanceCents: 20_000, count: 2 },
      { label: "61–90 dias", balanceCents: 20_000, count: 2 },
      { label: "Mais de 90 dias", balanceCents: 10_000, count: 1 },
    ]);
    assert.equal(result.overdueCents, 66_000);
    const empty = await finance(db, ADMIN.id).analytics({
      year: 2095,
      now: new Date("2094-04-02T02:30:00Z"),
    });
    assert.deepEqual(empty.methods, []);
    assert.deepEqual(empty.aging, result.aging);
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});
