import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import {
  FINANCE_DUE_DAY_FIFTEENTH,
  FINANCE_DUE_DAY_TENTH,
  generateInstallments,
} from "@lazuli/domain";
import { db } from "@lazuli/db";
import { InstallmentAdjustmentType, PaymentMethod } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ORDER_LOCKED_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
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

const DATE_ONLY_PREFIX_LENGTH = 10;
const DEFAULT_ORDER_START_DATE = "2026-01-03";
const UPDATED_ORDER_START_DATE = new Date("2026-02-01T00:00:00.000Z");
const LOCKED_UPDATE_START_DATE = new Date("2026-03-01T00:00:00.000Z");
const PAYMENT_EVENT_DATE = new Date("2026-01-10T00:00:00.000Z");
const UPDATED_PRINCIPAL_CENTS = 90_000;
const LOCKED_UPDATE_PRINCIPAL_CENTS = 80_000;
const SPLIT_INSTALLMENT_CENTS = 45_000;
const PAYMENT_AMOUNT_CENTS = 10_000;
const DISCOUNT_AMOUNT_CENTS = -1000;
const TWO_INSTALLMENTS = 2;
const SINGLE_BENEFICIARY = 1;
const MISSING_ENTITY_ID = "00000000-0000-0000-0000-000000000099";

void describe("finance.createPayer", () => {
  registerFinanceDatabaseHooks();

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
  registerFinanceDatabaseHooks();
  registerCreateOrderHappyPath();
  registerCreateOrderInlinePayer();
  registerCreateOrderValidationErrors();
});

void describe("finance.updateOrder", () => {
  registerFinanceDatabaseHooks();
  registerUpdateOrderHappyPath();
  registerUpdateOrderCutoffErrors();
});

function registerFinanceDatabaseHooks(): void {
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
}

function registerCreateOrderHappyPath(): void {
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
    assert.equal(result.beneficiaries.length, SINGLE_BENEFICIARY);

    const expected = generateInstallments({
      principalAmountCents: DEFAULT_ORDER_INPUT.principalAmountCents,
      installmentCount: DEFAULT_ORDER_INPUT.installmentCount,
      startDate: DEFAULT_ORDER_START_DATE,
      dueDay: DEFAULT_ORDER_INPUT.dueDay,
    });

    assert.deepEqual(
      result.installments.map((row) => row.amountCents),
      expected.map((row) => row.amountCents),
    );
    assert.deepEqual(
      result.installments.map((row) => row.dueDate.toISOString().slice(0, DATE_ONLY_PREFIX_LENGTH)),
      expected.map((row) => row.dueDate),
    );

    const storedSum = result.installments.reduce((total, row) => total + row.amountCents, 0);
    assert.equal(storedSum, DEFAULT_ORDER_INPUT.principalAmountCents);
  });
}

function registerCreateOrderInlinePayer(): void {
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
}

function registerCreateOrderValidationErrors(): void {
  databaseIt("rejects missing beneficiary students", async () => {
    const payer = await createPayer("Missing Student Payer");

    await expectRejects(
      caller().finance.createOrder({
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: payer.id },
        beneficiaryStudentIds: [MISSING_ENTITY_ID],
      }),
      STUDENT_NOT_FOUND_MESSAGE,
    );
  });

  databaseIt("rejects missing payers", async () => {
    const student = await createStudent("Missing Payer Student");

    await expectRejects(
      caller().finance.createOrder({
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: MISSING_ENTITY_ID },
        beneficiaryStudentIds: [student.id],
      }),
      PAYER_NOT_FOUND_MESSAGE,
    );
  });
}

function registerUpdateOrderHappyPath(): void {
  databaseIt("regenerates installments while the order has no financial activity", async () => {
    const created = await createOrderFixture();

    const updated = await caller().finance.updateOrder({
      orderId: created.order.id,
      kind: "TUITION",
      beneficiaryStudentIds: [created.studentId],
      principalAmountCents: UPDATED_PRINCIPAL_CENTS,
      installmentCount: TWO_INSTALLMENTS,
      startDate: UPDATED_ORDER_START_DATE,
      dueDay: FINANCE_DUE_DAY_TENTH,
    });

    assert.equal(updated.order.principalAmountCents, UPDATED_PRINCIPAL_CENTS);
    assert.equal(updated.installments.length, TWO_INSTALLMENTS);
    assert.deepEqual(
      updated.installments.map((row) => row.amountCents),
      [SPLIT_INSTALLMENT_CENTS, SPLIT_INSTALLMENT_CENTS],
    );
  });
}

function registerUpdateOrderCutoffErrors(): void {
  databaseIt("rejects updates after a payment allocation exists", async () => {
    const created = await createOrderFixture();
    const paymentEntry = await db.paymentEntry.create({
      data: {
        payerId: created.payerId,
        date: PAYMENT_EVENT_DATE,
        amountCents: PAYMENT_AMOUNT_CENTS,
        method: PaymentMethod.PIX,
      },
    });
    await db.paymentAllocation.create({
      data: {
        paymentEntryId: paymentEntry.id,
        installmentId: created.installmentId,
        amountCents: PAYMENT_AMOUNT_CENTS,
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
        amountCents: DISCOUNT_AMOUNT_CENTS,
        reason: "Desconto",
      },
    });

    await expectRejects(updateOrderFixture(created), ORDER_LOCKED_MESSAGE);
  });
}

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
    principalAmountCents: LOCKED_UPDATE_PRINCIPAL_CENTS,
    installmentCount: TWO_INSTALLMENTS,
    startDate: LOCKED_UPDATE_START_DATE,
    dueDay: FINANCE_DUE_DAY_FIFTEENTH,
  });
}
