import type { DatabaseClient, TransactionClient } from "./client.js";
import { addDays, stableUuid, utcDate } from "./seed-dev-support.js";
import { createJointOrderForSharedPayerScenario } from "./seed-dev-finance-joint.js";

/** Refreshes the versioned local finance scenarios without removing unrelated local records. */
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
const PAYMENT_LEAD_DAYS = 2;
const COMMON_INSTALLMENT_CENTS = 76_000;
const PARTIAL_PAYMENT_CENTS = 30_000;
const BRUNO_INSTALLMENT_CENTS = 38_000;

export type FinanceSeedInput = {
  todayIso: string;
  studentIds: ReadonlyMap<string, string>;
  workspaceInitializationKey?: string;
};
type InstallmentsInput = {
  scenarioKey: string;
  orderId: string;
  amountCents: number;
  dueDates: Date[];
  waivedIndex?: number;
};
type MonthlyDueDatesInput = { firstDueMonthOffset: number; dueDay: number; count: number };
type MonthlyDueDateInput = { monthOffset: number; dueDay: number };
export type FinanceDatabase = Pick<
  TransactionClient,
  | "financeSettings"
  | "payer"
  | "order"
  | "orderBeneficiary"
  | "installment"
  | "installmentAdjustment"
  | "paymentEntry"
  | "paymentAllocation"
  | "$executeRawUnsafe"
>;

export async function seedDevFinance(
  database: DatabaseClient,
  input: FinanceSeedInput,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    await transaction.financeSettings.upsert({
      where: { id: FINANCE_SETTINGS_ID },
      create: { id: FINANCE_SETTINGS_ID },
      update: {},
    });
    await createSharedPayerScenario(transaction, input);
    await createBrunoScenario(transaction, input);
    await createJointOrderForSharedPayerScenario(transaction, input);
    if (input.workspaceInitializationKey !== undefined) {
      await transaction.$executeRawUnsafe(
        'INSERT INTO "lazuli_local"."workspace_initializations" (key, completed_at) VALUES ($1, NOW()) ON CONFLICT (key) DO UPDATE SET completed_at = EXCLUDED.completed_at',
        input.workspaceInitializationKey,
      );
    }
  });
}

async function createSharedPayerScenario(
  database: FinanceDatabase,
  input: FinanceSeedInput,
): Promise<void> {
  const payerId = stableUuid([DEV_FINANCE_KEY, "shared-payer"]);
  const sharedOrderKey = "shared-order";
  const orderId = stableUuid([DEV_FINANCE_KEY, sharedOrderKey]);
  await database.payer.upsert({
    where: { id: payerId },
    create: { id: payerId, name: "Patrícia Ferreira", phone: "(11) 98123-9012" },
    update: { name: "Patrícia Ferreira", phone: "(11) 98123-9012", deletedAt: null },
  });
  const orderData = {
    id: orderId,
    payerId,
    kind: "TUITION" as const,
    principalAmountCents: COMMON_INSTALLMENT_CENTS * SHARED_INSTALLMENT_COUNT,
    startDate: sharedOrderStartDate(input.todayIso),
    dueDay: SHARED_DUE_DAY,
    deletedAt: null,
  };
  await database.order.upsert({
    where: { id: orderId },
    create: orderData,
    update: orderData,
  });
  await upsertSharedBeneficiaries(database, {
    studentIds: input.studentIds,
    orderId,
    sharedOrderKey,
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

async function upsertSharedBeneficiaries(
  database: FinanceDatabase,
  input: {
    studentIds: ReadonlyMap<string, string>;
    orderId: string;
    sharedOrderKey: string;
  },
): Promise<void> {
  for (const beneficiary of [
    {
      id: stableUuid([DEV_FINANCE_KEY, input.sharedOrderKey, "davi"]),
      orderId: input.orderId,
      studentId: studentId(input.studentIds, "davi"),
    },
    {
      id: stableUuid([DEV_FINANCE_KEY, input.sharedOrderKey, "isadora"]),
      orderId: input.orderId,
      studentId: studentId(input.studentIds, "isadora"),
    },
  ]) {
    await database.orderBeneficiary.upsert({
      where: { id: beneficiary.id },
      create: beneficiary,
      update: { ...beneficiary, deletedAt: null },
    });
  }
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
  await database.payer.upsert({
    where: { id: payerId },
    create: { id: payerId, name: "Bruno Carvalho" },
    update: { name: "Bruno Carvalho", deletedAt: null },
  });
  const orderData = {
    id: orderId,
    payerId,
    kind: "TUITION" as const,
    principalAmountCents: BRUNO_INSTALLMENT_CENTS * BRUNO_INSTALLMENT_COUNT,
    startDate: monthlyDueDate(input.todayIso, {
      monthOffset: BRUNO_START_MONTH_OFFSET,
      dueDay: BRUNO_DUE_DAY,
    }),
    dueDay: BRUNO_DUE_DAY,
    deletedAt: null,
  };
  await database.order.upsert({
    where: { id: orderId },
    create: orderData,
    update: orderData,
  });
  await upsertBrunoBeneficiary(database, { studentIds: input.studentIds, orderId });
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

async function upsertBrunoBeneficiary(
  database: FinanceDatabase,
  input: { studentIds: ReadonlyMap<string, string>; orderId: string },
): Promise<void> {
  const beneficiary = {
    id: stableUuid([DEV_FINANCE_KEY, "bruno-order", "bruno"]),
    orderId: input.orderId,
    studentId: studentId(input.studentIds, "bruno"),
  };
  await database.orderBeneficiary.upsert({
    where: { id: beneficiary.id },
    create: beneficiary,
    update: { ...beneficiary, deletedAt: null },
  });
}

export async function createInstallments(
  database: FinanceDatabase,
  input: InstallmentsInput,
): Promise<string[]> {
  const ids = input.dueDates.map((_dueDate, index) =>
    stableUuid([DEV_FINANCE_KEY, input.scenarioKey, `installment-${index + 1}`]),
  );
  for (const [index, dueDate] of input.dueDates.entries()) {
    const data = {
      id: itemAt(ids, index),
      orderId: input.orderId,
      sequenceNumber: index + 1,
      amountCents: input.amountCents,
      dueDate,
      waivedAt: index === input.waivedIndex ? dueDate : null,
      waivedReason: index === input.waivedIndex ? "Cenário de desenvolvimento" : null,
      deletedAt: null,
    };
    await database.installment.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }
  return ids;
}

export async function createPayment(
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
  const paymentData = {
    id: paymentEntryId,
    payerId: input.payerId,
    date: input.date,
    amountCents: input.amountCents,
    method: "PIX",
    deletedAt: null,
  } as const;
  await database.paymentEntry.upsert({
    where: { id: paymentEntryId },
    create: paymentData,
    update: paymentData,
  });
  const allocationData = {
    id: stableUuid([DEV_FINANCE_KEY, input.scenarioKey, "allocation"]),
    paymentEntryId,
    installmentId: input.installmentId,
    amountCents: input.amountCents,
    deletedAt: null,
  };
  await database.paymentAllocation.upsert({
    where: { id: allocationData.id },
    create: allocationData,
    update: allocationData,
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

export function monthlyDueDate(todayIso: string, input: MonthlyDueDateInput): Date {
  const today = utcDate(todayIso);
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + input.monthOffset, input.dueDay),
  );
}

export function studentId(studentIds: ReadonlyMap<string, string>, key: string): string {
  const id = studentIds.get(key);
  if (id === undefined) throw new Error(`Dev seed misconfiguration: missing student ${key}.`);
  return id;
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items.at(index);
  if (item === undefined) throw new Error(`Dev seed misconfiguration: missing item ${index}.`);
  return item;
}
