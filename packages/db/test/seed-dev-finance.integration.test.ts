import assert from "node:assert/strict";
import { it } from "node:test";

import { createDbClient } from "../src/client.js";
import { seedDevFinance } from "../src/seed-dev-finance.js";
import { stableUuid } from "../src/seed-dev-support.js";

const TODAY = "2026-09-15";
const DEV_FINANCE_KEY = "dev-finance";
const SHARED_PAYER_ID = stableUuid([DEV_FINANCE_KEY, "shared-payer"]);
const BRUNO_PAYER_ID = stableUuid([DEV_FINANCE_KEY, "bruno-payer"]);
const PARTIAL_PAYMENT_CENTS = 30_000;
const BRUNO_PAYMENT_CENTS = 38_000;
const SHARED_PAYMENT_CENTS = 76_000;
const PARTIAL_BALANCE_CENTS = 46_000;
const JOINT_ORDER_PARTIAL_PAYMENT_CENTS = 9000;
const JOINT_ORDER_BALANCE_CENTS = 26_000;
const OBSOLETE_PAYER_NAME = "Obsolete payer";
const OBSOLETE_DATE = new Date("2026-01-01");
const DATE_ONLY_LENGTH = 10;

void it("refreshes explicit development finance scenarios without removing unrelated records", async () => {
  const database = createDbClient();
  const students = await createStudents(database);
  try {
    await createObsoleteFinanceGraph(database, students.get("bruno"));

    await seedDevFinance(database, { todayIso: TODAY, studentIds: students });
    const first = await financeSnapshot(database);

    assertFinanceScenarios(first, students);
    assert.equal(first.obsoleteRecords, 1);
    await assertOrderSchedules(database);
    await assertSecondSeedMatches(database, { students, first });
  } finally {
    await clearFinance(database);
    await database.student.deleteMany({ where: { id: { in: [...students.values()] } } });
    await database.$disconnect();
  }
});

function assertFinanceScenarios(
  first: FinanceSnapshot,
  students: ReadonlyMap<string, string>,
): void {
  assert.deepEqual(first.payers, [
    { id: SHARED_PAYER_ID, name: "Patrícia Ferreira" },
    { id: BRUNO_PAYER_ID, name: "Bruno Carvalho" },
  ]);
  assert.deepEqual(
    new Set(
      first.orderBeneficiaries.map(
        (beneficiary) => `${beneficiary.payerId}/${beneficiary.studentId}`,
      ),
    ),
    new Set([
      `${SHARED_PAYER_ID}/${students.get("davi")}`,
      `${SHARED_PAYER_ID}/${students.get("isadora")}`,
      `${SHARED_PAYER_ID}/${students.get("ana")}`,
      `${SHARED_PAYER_ID}/${students.get("joao")}`,
      `${BRUNO_PAYER_ID}/${students.get("bruno")}`,
    ]),
  );
  assert.deepEqual(
    new Set(first.installmentCounts.map((item) => `${item.payerId}/${item.count}`)),
    new Set([`${SHARED_PAYER_ID}/7`, `${SHARED_PAYER_ID}/1`, `${BRUNO_PAYER_ID}/2`]),
  );
  assert.deepEqual(first.payments, [
    { payerId: SHARED_PAYER_ID, amountCents: JOINT_ORDER_PARTIAL_PAYMENT_CENTS },
    { payerId: SHARED_PAYER_ID, amountCents: PARTIAL_PAYMENT_CENTS },
    { payerId: SHARED_PAYER_ID, amountCents: SHARED_PAYMENT_CENTS },
    { payerId: BRUNO_PAYER_ID, amountCents: BRUNO_PAYMENT_CENTS },
  ]);
  assert.deepEqual(first.allocations, [
    JOINT_ORDER_PARTIAL_PAYMENT_CENTS,
    PARTIAL_PAYMENT_CENTS,
    BRUNO_PAYMENT_CENTS,
    SHARED_PAYMENT_CENTS,
  ]);
  assert.deepEqual(first.waivers, [
    { amountCents: SHARED_PAYMENT_CENTS, reason: "Cenário de desenvolvimento" },
  ]);
  assert.equal(first.partialBalanceCents, PARTIAL_BALANCE_CENTS);
  assert.equal(first.jointOrderBalanceCents, JOINT_ORDER_BALANCE_CENTS);
}

async function createStudents(
  database: ReturnType<typeof createDbClient>,
): Promise<Map<string, string>> {
  const students = new Map<string, string>();
  const scenarioStudentKeys = ["ana", "bruno", "davi", "isadora", "joao"];
  for (const key of scenarioStudentKeys) {
    const student = await database.student.create({ data: { fullName: `Finance seed ${key}` } });
    students.set(key, student.id);
  }
  return students;
}

async function createObsoleteFinanceGraph(
  database: ReturnType<typeof createDbClient>,
  studentId: string | undefined,
): Promise<void> {
  if (studentId === undefined) throw new Error("Missing Bruno student.");
  const payer = await database.payer.create({ data: { name: OBSOLETE_PAYER_NAME } });
  const order = await database.order.create({
    data: {
      payerId: payer.id,
      kind: "TUITION",
      principalAmountCents: 1,
      startDate: OBSOLETE_DATE,
      dueDay: 10,
    },
  });
  const installment = await database.installment.create({
    data: { orderId: order.id, sequenceNumber: 1, amountCents: 1, dueDate: OBSOLETE_DATE },
  });
  const payment = await database.paymentEntry.create({
    data: { payerId: payer.id, date: OBSOLETE_DATE, amountCents: 1, method: "PIX" },
  });
  await database.orderBeneficiary.create({ data: { orderId: order.id, studentId } });
  await database.paymentAllocation.create({
    data: { paymentEntryId: payment.id, installmentId: installment.id, amountCents: 1 },
  });
  await database.installmentAdjustment.create({
    data: { installmentId: installment.id, type: "DISCOUNT", amountCents: -1 },
  });
}

async function financeSnapshot(
  database: ReturnType<typeof createDbClient>,
): Promise<FinanceSnapshot> {
  const { payers, beneficiaries, orders, payments, allocations, waivers, obsolete } =
    await fixtureFinanceRecords(database);
  const [partialBalanceCents, jointOrderBalanceCents] = await Promise.all([
    seededInstallmentBalance(database, [DEV_FINANCE_KEY, "shared", "installment-3"]),
    seededInstallmentBalance(database, [DEV_FINANCE_KEY, "homonym-joint-order", "installment-1"]),
  ]);
  return {
    payers,
    orderBeneficiaries: beneficiaries.map((beneficiary) => ({
      payerId: beneficiary.order.payerId,
      studentId: beneficiary.studentId,
    })),
    installmentCounts: orders.map((order) => ({
      payerId: order.payerId,
      count: order.installments.length,
    })),
    payments,
    allocations: allocations.map((allocation) => allocation.amountCents),
    waivers: formatWaivers(waivers),
    partialBalanceCents,
    jointOrderBalanceCents,
    obsoleteRecords: obsolete,
  };
}

async function seededInstallmentBalance(
  database: ReturnType<typeof createDbClient>,
  stableIdParts: readonly string[],
): Promise<number> {
  const installment = await database.installment.findUniqueOrThrow({
    where: { id: stableUuid(stableIdParts) },
    include: { allocations: true },
  });
  return installmentBalance(installment);
}

async function fixtureFinanceRecords(
  database: ReturnType<typeof createDbClient>,
): Promise<FixtureFinanceRecords> {
  const [payers, beneficiaries, orders, payments, allocations, waivers, obsolete] =
    await Promise.all([
      database.payer.findMany({
        where: { id: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      }),
      database.orderBeneficiary.findMany({
        where: { order: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } } },
        include: { order: { select: { payerId: true } } },
        orderBy: { studentId: "asc" },
      }),
      database.order.findMany({
        where: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } },
        include: { installments: { select: { id: true } } },
        orderBy: { payerId: "asc" },
      }),
      database.paymentEntry.findMany({
        where: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } },
        select: { payerId: true, amountCents: true },
        orderBy: [{ payerId: "asc" }, { amountCents: "asc" }],
      }),
      database.paymentAllocation.findMany({
        where: { paymentEntry: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } } },
        select: { amountCents: true },
        orderBy: { amountCents: "asc" },
      }),
      database.installment.findMany({
        where: {
          waivedAt: { not: null },
          order: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } },
        },
        select: { amountCents: true, waivedReason: true },
      }),
      database.payer.count({ where: { name: OBSOLETE_PAYER_NAME } }),
    ]);
  return { payers, beneficiaries, orders, payments, allocations, waivers, obsolete };
}

function formatWaivers(
  waivers: Array<{ amountCents: number; waivedReason: string | null }>,
): Array<{ amountCents: number; reason: string | null }> {
  return waivers.map((waiver) => ({
    amountCents: waiver.amountCents,
    reason: waiver.waivedReason,
  }));
}

async function orderSchedules(
  database: ReturnType<typeof createDbClient>,
): Promise<
  Array<{ payerId: string | null; startDate: string; dueDay: number; dueDates: string[] }>
> {
  const orders = await database.order.findMany({
    where: { payerId: { in: [SHARED_PAYER_ID, BRUNO_PAYER_ID] } },
    include: { installments: { orderBy: { sequenceNumber: "asc" } } },
    orderBy: { startDate: "asc" },
  });
  return orders.map((order) => ({
    payerId: order.payerId,
    startDate: order.startDate.toISOString().slice(0, DATE_ONLY_LENGTH),
    dueDay: order.dueDay,
    dueDates: order.installments.map((installment) =>
      installment.dueDate.toISOString().slice(0, DATE_ONLY_LENGTH),
    ),
  }));
}

async function assertOrderSchedules(database: ReturnType<typeof createDbClient>): Promise<void> {
  assert.deepEqual(await orderSchedules(database), [
    {
      payerId: SHARED_PAYER_ID,
      startDate: "2026-03-25",
      dueDay: 25,
      dueDates: [
        "2026-04-25",
        "2026-05-25",
        "2026-06-25",
        "2026-07-25",
        "2026-08-25",
        "2026-09-25",
        "2026-10-25",
      ],
    },
    {
      payerId: BRUNO_PAYER_ID,
      startDate: "2026-07-10",
      dueDay: 10,
      dueDates: ["2026-08-10", "2026-09-10"],
    },
    {
      payerId: SHARED_PAYER_ID,
      startDate: "2026-08-10",
      dueDay: 10,
      dueDates: ["2026-09-10"],
    },
  ]);
}

async function assertSecondSeedMatches(
  database: ReturnType<typeof createDbClient>,
  input: { students: ReadonlyMap<string, string>; first: FinanceSnapshot },
): Promise<void> {
  await seedDevFinance(database, { todayIso: TODAY, studentIds: input.students });
  assert.deepEqual(await financeSnapshot(database), input.first);
}

function installmentBalance(installment: {
  amountCents: number;
  allocations: Array<{ amountCents: number }>;
}): number {
  return (
    installment.amountCents -
    installment.allocations.reduce((total, allocation) => total + allocation.amountCents, 0)
  );
}

type FinanceSnapshot = {
  payers: Array<{ id: string; name: string }>;
  orderBeneficiaries: Array<{ payerId: string | null; studentId: string }>;
  installmentCounts: Array<{ payerId: string | null; count: number }>;
  payments: Array<{ payerId: string; amountCents: number }>;
  allocations: number[];
  waivers: Array<{ amountCents: number; reason: string | null }>;
  partialBalanceCents: number;
  jointOrderBalanceCents: number;
  obsoleteRecords: number;
};

type FixtureFinanceRecords = {
  payers: FinanceSnapshot["payers"];
  beneficiaries: Array<{ studentId: string; order: { payerId: string | null } }>;
  orders: Array<{ payerId: string | null; installments: Array<{ id: string }> }>;
  payments: FinanceSnapshot["payments"];
  allocations: Array<{ amountCents: number }>;
  waivers: Array<{ amountCents: number; waivedReason: string | null }>;
  obsolete: number;
};

async function clearFinance(database: ReturnType<typeof createDbClient>): Promise<void> {
  await database.paymentAllocation.deleteMany();
  await database.installmentAdjustment.deleteMany();
  await database.paymentEntry.deleteMany();
  await database.installment.deleteMany();
  await database.orderBeneficiary.deleteMany();
  await database.order.deleteMany();
  await database.payer.deleteMany();
  await database.financeSettings.deleteMany();
}
