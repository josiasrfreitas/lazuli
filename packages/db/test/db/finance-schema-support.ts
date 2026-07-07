import type { createDbClient } from "../../src/client.js";
import { OrderKind, PaymentMethod } from "../../src/generated/prisma/enums.js";

export const TEST_PREFIX = "GRE-42 ";
export const START_DATE = new Date("2026-01-01T00:00:00.000Z");
export const DUE_DATE = new Date("2026-01-05T00:00:00.000Z");
export const EVENT_DATE = new Date("2026-01-10T00:00:00.000Z");
export const PRINCIPAL_AMOUNT_CENTS = 120_000;
export const PAYMENT_AMOUNT_CENTS = 60_000;

type DatabaseClient = ReturnType<typeof createDbClient>;

export type FinanceFixture = {
  payerId: string;
  studentId: string;
  orderId: string;
  installmentId: string;
  paymentEntryId: string;
};

export async function cleanFinanceSchemaTestData(database: DatabaseClient): Promise<void> {
  const scope = await findFinanceScope(database);

  await database.paymentAllocation.deleteMany({
    where: {
      OR: [
        { paymentEntryId: { in: scope.paymentEntryIds } },
        { installmentId: { in: scope.installmentIds } },
      ],
    },
  });
  await database.paymentEntry.deleteMany({ where: { id: { in: scope.paymentEntryIds } } });
  await database.installmentAdjustment.deleteMany({
    where: { installmentId: { in: scope.installmentIds } },
  });
  await database.installment.deleteMany({ where: { id: { in: scope.installmentIds } } });
  await database.orderBeneficiary.deleteMany({
    where: {
      OR: [
        { orderId: { in: scope.orderIds } },
        { studentId: { in: scope.studentIds } },
      ],
    },
  });
  await database.order.deleteMany({ where: { id: { in: scope.orderIds } } });
  await database.payer.deleteMany({ where: { id: { in: scope.payerIds } } });
  await database.student.deleteMany({ where: { id: { in: scope.studentIds } } });
  await database.financeSettings.deleteMany({ where: { id: "singleton" } });
}

export async function createFinanceFixture(
  database: DatabaseClient,
  suffix: string,
): Promise<FinanceFixture> {
  const payer = await createPayer(database, suffix);
  const student = await createStudent(database, suffix);
  const order = await createOrder(database, payer.id);
  await createOrderBeneficiary(database, { orderId: order.id, studentId: student.id });
  const installment = await createInstallment(database, order.id);
  const paymentEntry = await createPaymentEntry(database, payer.id);
  await createPaymentAllocation(database, {
    installmentId: installment.id,
    paymentEntryId: paymentEntry.id,
  });

  return {
    installmentId: installment.id,
    orderId: order.id,
    payerId: payer.id,
    paymentEntryId: paymentEntry.id,
    studentId: student.id,
  };
}

async function findFinanceScope(database: DatabaseClient): Promise<{
  payerIds: string[];
  studentIds: string[];
  orderIds: string[];
  installmentIds: string[];
  paymentEntryIds: string[];
}> {
  const payerIds = await findPayerIds(database);
  const studentIds = await findStudentIds(database);
  const orderIds = await findOrderIds(database, { payerIds, studentIds });
  const installmentIds = await findInstallmentIds(database, orderIds);
  const paymentEntryIds = await findPaymentEntryIds(database, payerIds);

  return { installmentIds, orderIds, payerIds, paymentEntryIds, studentIds };
}

async function findPayerIds(database: DatabaseClient): Promise<string[]> {
  const payers = await database.payer.findMany({
    select: { id: true },
    where: { name: { startsWith: TEST_PREFIX } },
  });
  return payers.map((payer) => payer.id);
}

async function findStudentIds(database: DatabaseClient): Promise<string[]> {
  const students = await database.student.findMany({
    select: { id: true },
    where: { fullName: { startsWith: TEST_PREFIX } },
  });
  return students.map((student) => student.id);
}

async function findOrderIds(
  database: DatabaseClient,
  scope: { payerIds: string[]; studentIds: string[] },
): Promise<string[]> {
  const orders = await database.order.findMany({
    select: { id: true },
    where: {
      OR: [
        { payerId: { in: scope.payerIds } },
        { beneficiaries: { some: { studentId: { in: scope.studentIds } } } },
      ],
    },
  });
  return orders.map((order) => order.id);
}

async function findInstallmentIds(database: DatabaseClient, orderIds: string[]): Promise<string[]> {
  const installments = await database.installment.findMany({
    select: { id: true },
    where: { orderId: { in: orderIds } },
  });
  return installments.map((installment) => installment.id);
}

async function findPaymentEntryIds(database: DatabaseClient, payerIds: string[]): Promise<string[]> {
  const paymentEntries = await database.paymentEntry.findMany({
    select: { id: true },
    where: { payerId: { in: payerIds } },
  });
  return paymentEntries.map((paymentEntry) => paymentEntry.id);
}

async function createPayer(database: DatabaseClient, suffix: string): Promise<{ id: string }> {
  return database.payer.create({
    data: {
      email: `${suffix.toLowerCase().replaceAll(" ", "-")}@example.com`,
      name: `${TEST_PREFIX}Payer ${suffix}`,
      phone: "82999999999",
      taxId: "12345678900",
    },
    select: { id: true },
  });
}

async function createStudent(database: DatabaseClient, suffix: string): Promise<{ id: string }> {
  return database.student.create({
    data: {
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      fullName: `${TEST_PREFIX}Student ${suffix}`,
    },
    select: { id: true },
  });
}

async function createOrder(database: DatabaseClient, payerId: string): Promise<{ id: string }> {
  return database.order.create({
    data: {
      dueDay: 5,
      kind: OrderKind.TUITION,
      payerId,
      principalAmountCents: PRINCIPAL_AMOUNT_CENTS,
      startDate: START_DATE,
    },
    select: { id: true },
  });
}

async function createOrderBeneficiary(
  database: DatabaseClient,
  data: { orderId: string; studentId: string },
): Promise<void> {
  await database.orderBeneficiary.create({
    data,
  });
}

async function createInstallment(database: DatabaseClient, orderId: string): Promise<{ id: string }> {
  return database.installment.create({
    data: {
      amountCents: PRINCIPAL_AMOUNT_CENTS,
      dueDate: DUE_DATE,
      orderId,
    },
    select: { id: true },
  });
}

async function createPaymentEntry(
  database: DatabaseClient,
  payerId: string,
): Promise<{ id: string }> {
  return database.paymentEntry.create({
    data: {
      amountCents: PAYMENT_AMOUNT_CENTS,
      date: EVENT_DATE,
      method: PaymentMethod.PIX,
      payerId,
    },
    select: { id: true },
  });
}

async function createPaymentAllocation(
  database: DatabaseClient,
  data: { installmentId: string; paymentEntryId: string },
): Promise<void> {
  await database.paymentAllocation.create({
    data: {
      amountCents: PAYMENT_AMOUNT_CENTS,
      installmentId: data.installmentId,
      paymentEntryId: data.paymentEntryId,
    },
  });
}
