import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { generateInstallments } from "@lazuli/domain";
import { db } from "@lazuli/db";
import { InstallmentAdjustmentType, PaymentMethod } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ORDER_LOCKED_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
} from "../../src/finance/errors.js";
import {
  caller,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
  expectRejects,
} from "./finance-test-support.js";

void describe("finance.createPayer", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase();
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase();
    await db.$disconnect();
  });

  databaseIt("creates a payer with optional contact fields", async () => {
    const payer = await caller().finance.createPayer({
      name: "GRE-43 Inline Payer",
      taxId: "12345678901",
      phone: "11999999999",
      email: "payer@example.com",
    });

    assert.equal(payer.name, "GRE-43 Inline Payer");
    assert.equal(payer.taxId, "12345678901");
  });
});

void describe("finance.createOrder", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase();
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase();
    await db.$disconnect();
  });

  databaseIt("creates an order, beneficiaries, and generated installments", async () => {
    const payer = await createPayer("Order Payer");
    const student = await createStudent("Order Student");

    const result = await caller().finance.createOrder({
      ...DEFAULT_ORDER_INPUT,
      payer: { mode: "existing", payerId: payer.id },
      beneficiaryStudentIds: [student.id],
    });

    assert.equal(result.order.payerId, payer.id);
    assert.equal(result.order.principalAmountCents, DEFAULT_ORDER_INPUT.principalAmountCents);
    assert.equal(result.installments.length, DEFAULT_ORDER_INPUT.installmentCount);
    assert.equal(result.beneficiaries.length, 1);

    const expected = generateInstallments({
      principalAmountCents: DEFAULT_ORDER_INPUT.principalAmountCents,
      installmentCount: DEFAULT_ORDER_INPUT.installmentCount,
      startDate: "2026-01-03",
      dueDay: DEFAULT_ORDER_INPUT.dueDay,
    });

    assert.deepEqual(
      result.installments.map((row) => row.amountCents),
      expected.map((row) => row.amountCents),
    );
    assert.deepEqual(
      result.installments.map((row) => row.dueDate.toISOString().slice(0, 10)),
      expected.map((row) => row.dueDate),
    );

    const storedSum = result.installments.reduce((total, row) => total + row.amountCents, 0);
    assert.equal(storedSum, DEFAULT_ORDER_INPUT.principalAmountCents);
  });

  databaseIt("creates an inline payer when mode is create", async () => {
    const student = await createStudent("Inline Payer Student");

    const result = await caller().finance.createOrder({
      ...DEFAULT_ORDER_INPUT,
      payer: { mode: "create", name: "GRE-43 Created With Order" },
      beneficiaryStudentIds: [student.id],
    });

    const payer = await db.payer.findUniqueOrThrow({ where: { id: result.order.payerId } });
    assert.equal(payer.name, "GRE-43 Created With Order");
  });

  databaseIt("rejects missing beneficiary students", async () => {
    const payer = await createPayer("Missing Student Payer");

    await expectRejects(
      caller().finance.createOrder({
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: payer.id },
        beneficiaryStudentIds: ["00000000-0000-0000-0000-000000000099"],
      }),
      STUDENT_NOT_FOUND_MESSAGE,
    );
  });

  databaseIt("rejects missing payers", async () => {
    const student = await createStudent("Missing Payer Student");

    await expectRejects(
      caller().finance.createOrder({
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: "00000000-0000-0000-0000-000000000099" },
        beneficiaryStudentIds: [student.id],
      }),
      PAYER_NOT_FOUND_MESSAGE,
    );
  });
});

void describe("finance.updateOrder", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase();
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase();
    await db.$disconnect();
  });

  databaseIt("regenerates installments while the order has no financial activity", async () => {
    const created = await createOrderFixture();

    const updated = await caller().finance.updateOrder({
      orderId: created.order.id,
      kind: "TUITION",
      beneficiaryStudentIds: [created.studentId],
      principalAmountCents: 90_000,
      installmentCount: 2,
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      dueDay: 10,
    });

    assert.equal(updated.order.principalAmountCents, 90_000);
    assert.equal(updated.installments.length, 2);
    assert.deepEqual(
      updated.installments.map((row) => row.amountCents),
      [45_000, 45_000],
    );
  });

  databaseIt("rejects updates after a payment allocation exists", async () => {
    const created = await createOrderFixture();
    const paymentEntry = await db.paymentEntry.create({
      data: {
        payerId: created.payerId,
        date: new Date("2026-01-10T00:00:00.000Z"),
        amountCents: 10_000,
        method: PaymentMethod.PIX,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentEntryId: paymentEntry.id,
        installmentId: created.installmentId,
        amountCents: 10_000,
      },
    });

    await expectRejects(updateOrderFixture(created), ORDER_LOCKED_MESSAGE);
  });

  databaseIt("rejects updates after an installment waiver exists", async () => {
    const created = await createOrderFixture();
    await db.installment.update({
      where: { id: created.installmentId },
      data: { waivedAt: new Date(), waivedReason: "Bolsa" },
    });

    await expectRejects(updateOrderFixture(created), ORDER_LOCKED_MESSAGE);
  });

  databaseIt("rejects updates after an installment adjustment exists", async () => {
    const created = await createOrderFixture();
    await db.installmentAdjustment.create({
      data: {
        installmentId: created.installmentId,
        type: InstallmentAdjustmentType.DISCOUNT,
        amountCents: -1_000,
        reason: "Desconto",
      },
    });

    await expectRejects(updateOrderFixture(created), ORDER_LOCKED_MESSAGE);
  });
});

async function createOrderFixture(): Promise<{
  order: { id: string };
  payerId: string;
  studentId: string;
  installmentId: string;
}> {
  const payer = await createPayer("Update Payer");
  const student = await createStudent("Update Student");
  const result = await caller().finance.createOrder({
    ...DEFAULT_ORDER_INPUT,
    payer: { mode: "existing", payerId: payer.id },
    beneficiaryStudentIds: [student.id],
  });

  return {
    order: result.order,
    payerId: payer.id,
    studentId: student.id,
    installmentId: result.installments[0]?.id ?? "",
  };
}

async function updateOrderFixture(created: {
  order: { id: string };
  studentId: string;
}): Promise<unknown> {
  return caller().finance.updateOrder({
    orderId: created.order.id,
    kind: "TUITION",
    beneficiaryStudentIds: [created.studentId],
    principalAmountCents: 80_000,
    installmentCount: 2,
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    dueDay: 15,
  });
}
