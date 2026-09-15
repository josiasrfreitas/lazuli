import type { DatabaseClient, TransactionClient } from "./client.js";
import { addDays, stableUuid, utcDate } from "./seed-dev-support.js";

/**
 * Rebuilds the entire local development finance graph from explicit scenarios.
 */
const FINANCE_SETTINGS_ID = "singleton";
const DEV_FINANCE_KEY = "dev-finance";
const SHARED_SCENARIO_KEY = "shared";
const SHARED_INSTALLMENT_COUNT = 7;
const WAIVED_INSTALLMENT_INDEX = 4;
const SHARED_DUE_DAY = 25;
const SHARED_FIRST_DUE_MONTH_OFFSET = -5;
const SHARED_START_MONTH_OFFSET = -6;
const BRUNO_INSTALLMENT_COUNT = 2;
const BRUNO_DUE_DAY = 10;
const BRUNO_FIRST_DUE_MONTH_OFFSET = -1;
const BRUNO_START_MONTH_OFFSET = -2;
const JOINT_ORDER_DUE_DAY = 10;
const JOINT_ORDER_INSTALLMENT_CENTS = 35_000;
const JOINT_ORDER_PARTIAL_PAYMENT_CENTS = 9000;
const PAYMENT_LEAD_DAYS = 2;
const COMMON_INSTALLMENT_CENTS = 76_000;
const PARTIAL_PAYMENT_CENTS = 30_000;
const BRUNO_INSTALLMENT_CENTS = 38_000;

type FinanceSeedInput = { todayIso: string; studentIds: ReadonlyMap<string, string> };
type InstallmentsInput = {
  scenarioKey: string;
  orderId: string;
  amountCents: number;
  dueDates: Date[];
  waivedIndex?: number;
};
type MonthlyDueDatesInput = { firstDueMonthOffset: number; dueDay: number; count: number };
type MonthlyDueDateInput = { monthOffset: number; dueDay: number };
type FinanceDatabase = Pick<
  TransactionClient,
  | "financeSettings"
  | "payer"
  | "order"
  | "orderBeneficiary"
  | "installment"
  | "installmentAdjustment"
  | "paymentEntry"
  | "paymentAllocation"
>;

export async function seedDevFinance(
  database: DatabaseClient,
  input: FinanceSeedInput,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    await transaction.paymentAllocation.deleteMany();
    await transaction.installmentAdjustment.deleteMany();
    await transaction.paymentEntry.deleteMany();
    await transaction.installment.deleteMany();
    await transaction.orderBeneficiary.deleteMany();
    await transaction.order.deleteMany();
    await transaction.payer.deleteMany();
    await transaction.financeSettings.deleteMany();
    await transaction.financeSettings.create({ data: { id: FINANCE_SETTINGS_ID } });
    await createSharedPayerScenario(transaction, input);
    await createBrunoScenario(transaction, input);
    await createJointOrderForSharedPayerScenario(transaction, input);
  });
}

async function createJointOrderForSharedPayerScenario(
  database: FinanceDatabase,
  input: FinanceSeedInput,
): Promise<void> {
  const payerId = stableUuid([DEV_FINANCE_KEY, "shared-payer"]);
  // Keep the historical key so existing local fixture identifiers remain stable.
  const scenarioKey = "homonym-joint-order";
  const orderId = stableUuid([DEV_FINANCE_KEY, `${scenarioKey}-order`]);
  const dueDate = monthlyDueDate(input.todayIso, {
    monthOffset: 0,
    dueDay: JOINT_ORDER_DUE_DAY,
  });
  await database.order.create({
    data: {
      id: orderId,
      payerId,
      kind: "TUITION",
      principalAmountCents: JOINT_ORDER_INSTALLMENT_CENTS,
      startDate: monthlyDueDate(input.todayIso, { monthOffset: -1, dueDay: JOINT_ORDER_DUE_DAY }),
      dueDay: JOINT_ORDER_DUE_DAY,
    },
  });
  await database.orderBeneficiary.createMany({
    data: ["ana", "joao"].map((studentKey) => ({
      id: stableUuid([DEV_FINANCE_KEY, scenarioKey, studentKey]),
      orderId,
      studentId: studentId(input.studentIds, studentKey),
    })),
  });
  const [installmentId] = await createInstallments(database, {
    scenarioKey,
    orderId,
    amountCents: JOINT_ORDER_INSTALLMENT_CENTS,
    dueDates: [dueDate],
  });
  if (installmentId === undefined)
    throw new Error("Dev seed misconfiguration: missing installment.");
  await createPayment(database, {
    scenarioKey: `${scenarioKey}-partial`,
    payerId,
    installmentId,
    amountCents: JOINT_ORDER_PARTIAL_PAYMENT_CENTS,
    date: addDays(dueDate, 1),
  });
}

async function createSharedPayerScenario(
  database: FinanceDatabase,
  input: FinanceSeedInput,
): Promise<void> {
  const payerId = stableUuid([DEV_FINANCE_KEY, "shared-payer"]);
  const sharedOrderKey = "shared-order";
  const orderId = stableUuid([DEV_FINANCE_KEY, sharedOrderKey]);
  await database.payer.create({
    data: { id: payerId, name: "Patrícia Ferreira", phone: "(11) 98123-9012" },
  });
  await database.order.create({
    data: {
      id: orderId,
      payerId,
      kind: "TUITION",
      principalAmountCents: COMMON_INSTALLMENT_CENTS * SHARED_INSTALLMENT_COUNT,
      startDate: sharedOrderStartDate(input.todayIso),
      dueDay: SHARED_DUE_DAY,
    },
  });
  await database.orderBeneficiary.createMany({
    data: [
      {
        id: stableUuid([DEV_FINANCE_KEY, sharedOrderKey, "davi"]),
        orderId,
        studentId: studentId(input.studentIds, "davi"),
      },
      {
        id: stableUuid([DEV_FINANCE_KEY, sharedOrderKey, "isadora"]),
        orderId,
        studentId: studentId(input.studentIds, "isadora"),
      },
    ],
  });
  const dueDates = monthlyDueDates(input.todayIso, {
    firstDueMonthOffset: SHARED_FIRST_DUE_MONTH_OFFSET,
    dueDay: SHARED_DUE_DAY,
    count: SHARED_INSTALLMENT_COUNT,
  });
  const installmentIds = await createInstallments(database, {
    scenarioKey: SHARED_SCENARIO_KEY,
    orderId,
    amountCents: COMMON_INSTALLMENT_CENTS,
    dueDates,
    waivedIndex: WAIVED_INSTALLMENT_INDEX,
  });
  await createSharedPayments(database, { payerId, installmentIds, dueDates });
}

async function createSharedPayments(
  database: FinanceDatabase,
  input: { payerId: string; installmentIds: string[]; dueDates: Date[] },
): Promise<void> {
  await createPayment(database, {
    scenarioKey: "shared-paid",
    payerId: input.payerId,
    installmentId: itemAt(input.installmentIds, 0),
    amountCents: COMMON_INSTALLMENT_CENTS,
    date: addDays(itemAt(input.dueDates, 0), -PAYMENT_LEAD_DAYS),
  });
  await createPayment(database, {
    scenarioKey: "shared-partial",
    payerId: input.payerId,
    installmentId: itemAt(input.installmentIds, 2),
    amountCents: PARTIAL_PAYMENT_CENTS,
    date: addDays(itemAt(input.dueDates, 2), 1),
  });
}

async function createBrunoScenario(
  database: FinanceDatabase,
  input: FinanceSeedInput,
): Promise<void> {
  const payerId = stableUuid([DEV_FINANCE_KEY, "bruno-payer"]);
  const orderId = stableUuid([DEV_FINANCE_KEY, "bruno-order"]);
  await database.payer.create({ data: { id: payerId, name: "Bruno Carvalho" } });
  await database.order.create({
    data: {
      id: orderId,
      payerId,
      kind: "TUITION",
      principalAmountCents: BRUNO_INSTALLMENT_CENTS * BRUNO_INSTALLMENT_COUNT,
      startDate: monthlyDueDate(input.todayIso, {
        monthOffset: BRUNO_START_MONTH_OFFSET,
        dueDay: BRUNO_DUE_DAY,
      }),
      dueDay: BRUNO_DUE_DAY,
    },
  });
  await database.orderBeneficiary.create({
    data: {
      id: stableUuid([DEV_FINANCE_KEY, "bruno-order", "bruno"]),
      orderId,
      studentId: studentId(input.studentIds, "bruno"),
    },
  });
  const dueDates = monthlyDueDates(input.todayIso, {
    firstDueMonthOffset: BRUNO_FIRST_DUE_MONTH_OFFSET,
    dueDay: BRUNO_DUE_DAY,
    count: BRUNO_INSTALLMENT_COUNT,
  });
  const installmentIds = await createInstallments(database, {
    scenarioKey: "bruno",
    orderId,
    amountCents: BRUNO_INSTALLMENT_CENTS,
    dueDates,
  });
  await createPayment(database, {
    scenarioKey: "bruno-paid",
    payerId,
    installmentId: itemAt(installmentIds, 0),
    amountCents: BRUNO_INSTALLMENT_CENTS,
    date: addDays(itemAt(dueDates, 0), -1),
  });
}

async function createInstallments(
  database: FinanceDatabase,
  input: InstallmentsInput,
): Promise<string[]> {
  const ids = input.dueDates.map((_dueDate, index) =>
    stableUuid([DEV_FINANCE_KEY, input.scenarioKey, `installment-${index + 1}`]),
  );
  await database.installment.createMany({
    data: input.dueDates.map((dueDate, index) => ({
      id: itemAt(ids, index),
      orderId: input.orderId,
      sequenceNumber: index + 1,
      amountCents: input.amountCents,
      dueDate,
      waivedAt: index === input.waivedIndex ? dueDate : null,
      waivedReason: index === input.waivedIndex ? "Cenário de desenvolvimento" : null,
    })),
  });
  return ids;
}

async function createPayment(
  database: FinanceDatabase,
  input: {
    scenarioKey: string;
    payerId: string;
    installmentId: string;
    amountCents: number;
    date: Date;
  },
): Promise<void> {
  const paymentEntryId = stableUuid([DEV_FINANCE_KEY, input.scenarioKey, "payment"]);
  await database.paymentEntry.create({
    data: {
      id: paymentEntryId,
      payerId: input.payerId,
      date: input.date,
      amountCents: input.amountCents,
      method: "PIX",
    },
  });
  await database.paymentAllocation.create({
    data: {
      id: stableUuid([DEV_FINANCE_KEY, input.scenarioKey, "allocation"]),
      paymentEntryId,
      installmentId: input.installmentId,
      amountCents: input.amountCents,
    },
  });
}

function monthlyDueDates(todayIso: string, input: MonthlyDueDatesInput): Date[] {
  return Array.from({ length: input.count }, (_unused, index) =>
    monthlyDueDate(todayIso, {
      monthOffset: input.firstDueMonthOffset + index,
      dueDay: input.dueDay,
    }),
  );
}

function sharedOrderStartDate(todayIso: string): Date {
  return monthlyDueDate(todayIso, {
    monthOffset: SHARED_START_MONTH_OFFSET,
    dueDay: SHARED_DUE_DAY,
  });
}

function monthlyDueDate(todayIso: string, input: MonthlyDueDateInput): Date {
  const today = utcDate(todayIso);
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + input.monthOffset, input.dueDay),
  );
}

function studentId(studentIds: ReadonlyMap<string, string>, key: string): string {
  const id = studentIds.get(key);
  if (id === undefined) throw new Error(`Dev seed misconfiguration: missing student ${key}.`);
  return id;
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items.at(index);
  if (item === undefined) throw new Error(`Dev seed misconfiguration: missing item ${index}.`);
  return item;
}
