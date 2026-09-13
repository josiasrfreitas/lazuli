import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import { createDbClient } from "../src/client.js";
import { seedStudentFinance } from "../src/seed-dev-finance.js";
import { stableUuid, type SeedContext } from "../src/seed-dev-support.js";
import type { DevStudentSeed } from "../src/seed-dev-data.js";

const THIRD = 3;
const FOURTH = 4;
const FIFTH = 5;
const RETAINED_NUMBER = 6;
const INITIAL_SEQUENCE = [1, 2, THIRD, FOURTH, FIFTH];
const PRESERVED_SEQUENCE = [RETAINED_NUMBER, 2, THIRD, FOURTH, FIFTH];
const DATE_ONLY_LENGTH = 10;
const FIRST_HALF_DUE_DATES = ["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10"];
const SECOND_HALF_START = "2026-07-01";
const FIRST_HALF_START = "2026-01-01";
const REGENERATED_PRINCIPAL_CENTS = 2000;
const REGENERATED_FIRST_AMOUNT_CENTS = 1100;
const REGENERATED_SECOND_AMOUNT_CENTS = 900;
const REGENERATED_FIRST_ID = "00000000-0000-4000-8000-000000000002";
const REGENERATED_SECOND_ID = "00000000-0000-4000-8000-000000000001";

type DatabaseClient = ReturnType<typeof createDbClient>;
type ScheduleWhere = { orderId: string; deletedAt?: { not: null } };

void it("seeds finance repeatedly without duplicating or renumbering existing installments", async () => {
  const { database, studentSeed, context, student, orderId, payerId } = await createSeedFixture();
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const first = await database.installment.findMany({
      where: { orderId },
      orderBy: { dueDate: "asc" },
    });
    assert.deepEqual(
      first.map((row) => row.sequenceNumber),
      INITIAL_SEQUENCE,
    );
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const repeated = await database.installment.findMany({
      where: { orderId },
      orderBy: { dueDate: "asc" },
    });
    assert.deepEqual(
      repeated.map((row) => ({ id: row.id, sequenceNumber: row.sequenceNumber })),
      first.map((row) => ({ id: row.id, sequenceNumber: row.sequenceNumber })),
    );
    await assertSeedPayments(database, payerId);
    const firstId = first[0]?.id;
    assert.ok(firstId);
    await database.installment.update({ where: { id: firstId }, data: { sequenceNumber: 6 } });
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const second = await database.installment.findMany({
      where: { orderId },
      orderBy: { dueDate: "asc" },
    });
    assert.deepEqual(
      second.map((row) => row.id),
      first.map((row) => row.id),
    );
    assert.deepEqual(
      second.map((row) => row.sequenceNumber),
      PRESERVED_SEQUENCE,
    );
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

void it("keeps the persisted schedule when the current semester changes", async () => {
  const fixture = await createSeedFixture(FIRST_HALF_START);
  const { database, studentSeed, context, student, orderId, payerId } = fixture;
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const before = await readSchedule(database, { orderId });
    context.todayIso = SECOND_HALF_START;
    context.semester = {
      id: randomUUID(),
      name: "2026.2",
      startIso: SECOND_HALF_START,
      endIso: "2026-12-20",
      year: 2026,
    };

    await seedStudentFinance(context, { studentSeed, studentId: student.id });

    const after = await readSchedule(database, { orderId });
    assert.deepEqual(after, before);
    assert.deepEqual(
      after.map((row) => row.sequenceNumber),
      INITIAL_SEQUENCE,
    );
    assert.deepEqual(
      after.map((row) => row.dueDate),
      FIRST_HALF_DUE_DATES,
    );
    await assertSeedPayments(database, payerId);
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

void it("keeps a regenerated editable order schedule on the next seed run", async () => {
  const fixture = await createSeedFixture(FIRST_HALF_START);
  const { database, studentSeed, context, student, orderId, payerId } = fixture;
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const regenerated = await replaceWithRegeneratedSchedule(database, orderId);
    studentSeed.finance = "overdue";
    context.todayIso = "2026-05-01";

    await seedStudentFinance(context, { studentSeed, studentId: student.id });

    assert.deepEqual(await readSchedule(database, { orderId }), regenerated);
    assert.deepEqual(await readPayments(database, payerId), [
      { amount: REGENERATED_FIRST_AMOUNT_CENTS, date: "2026-03-08", method: "PIX" },
    ]);
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

void it("keeps the existing payment when a paid installment due date changes", async () => {
  const { database, studentSeed, context, student, orderId, payerId } = await createSeedFixture();
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const before = await readPaymentLinks(database, payerId);
    const firstInstallment = await database.installment.findFirstOrThrow({
      where: { orderId },
      orderBy: { dueDate: "asc" },
    });
    await database.installment.update({
      where: { id: firstInstallment.id },
      data: { dueDate: new Date("2026-01-20") },
    });

    await seedStudentFinance(context, { studentSeed, studentId: student.id });

    assert.deepEqual(await readPaymentLinks(database, payerId), before);
    const moved = await database.installment.findUniqueOrThrow({
      where: { id: firstInstallment.id },
    });
    assert.equal(moved.dueDate.toISOString().slice(0, DATE_ONLY_LENGTH), "2026-01-20");
    assert.equal(moved.sequenceNumber, 1);
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

void it("recreates a soft-deleted schedule without financial activity", async () => {
  const { database, studentSeed, context, student, orderId, payerId } =
    await createSeedFixture(FIRST_HALF_START);
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const deletedSchedule = await readSchedule(database, { orderId });
    await database.installment.updateMany({
      where: { orderId },
      data: { deletedAt: new Date("2026-01-02") },
    });

    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    await seedStudentFinance(context, { studentSeed, studentId: student.id });

    const activeSchedule = await readSchedule(database, { orderId });
    assert.deepEqual(
      activeSchedule.map((row) => row.sequenceNumber),
      INITIAL_SEQUENCE,
    );
    assert.deepEqual(
      activeSchedule.map((row) => row.dueDate),
      FIRST_HALF_DUE_DATES,
    );
    assert.equal(
      activeSchedule.some((row) => deletedSchedule.some((deleted) => deleted.id === row.id)),
      false,
    );
    assert.deepEqual(await readSchedule(database, deletedScope(orderId)), deletedSchedule);
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

void it("rejects recreation of a soft-deleted schedule with payment history", async () => {
  const { database, studentSeed, context, student, orderId, payerId } = await createSeedFixture();
  try {
    await seedStudentFinance(context, { studentSeed, studentId: student.id });
    const deletedSchedule = await readSchedule(database, { orderId });
    const paymentLinks = await readPaymentLinks(database, payerId);
    await database.installment.updateMany({
      where: { orderId },
      data: { deletedAt: new Date("2026-01-02") },
    });

    await assert.rejects(seedStudentFinance(context, { studentSeed, studentId: student.id }), {
      message: "Cannot recreate a soft-deleted installment schedule with financial activity",
    });

    assert.deepEqual(await readSchedule(database, { orderId }), []);
    assert.deepEqual(await readPaymentLinks(database, payerId), paymentLinks);
    assert.deepEqual(await readSchedule(database, deletedScope(orderId)), deletedSchedule);
  } finally {
    await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
    await database.$disconnect();
  }
});

async function readSchedule(
  database: DatabaseClient,
  where: ScheduleWhere,
): Promise<Array<{ id: string; sequenceNumber: number; amountCents: number; dueDate: string }>> {
  const rows = await database.installment.findMany({
    where,
    orderBy: { sequenceNumber: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    amountCents: row.amountCents,
    dueDate: row.dueDate.toISOString().slice(0, DATE_ONLY_LENGTH),
  }));
}

const deletedScope = (orderId: string): ScheduleWhere => ({ orderId, deletedAt: { not: null } });

async function replaceWithRegeneratedSchedule(
  database: DatabaseClient,
  orderId: string,
): ReturnType<typeof readSchedule> {
  await database.installment.deleteMany({ where: { orderId } });
  await database.order.update({
    where: { id: orderId },
    data: { principalAmountCents: REGENERATED_PRINCIPAL_CENTS, startDate: new Date("2026-03-01") },
  });
  await database.installment.createMany({
    data: [
      regeneratedInstallment({
        id: REGENERATED_SECOND_ID,
        orderId,
        sequenceNumber: 2,
        amountCents: REGENERATED_SECOND_AMOUNT_CENTS,
        dueDate: "2026-04-10",
      }),
      regeneratedInstallment({
        id: REGENERATED_FIRST_ID,
        orderId,
        sequenceNumber: 1,
        amountCents: REGENERATED_FIRST_AMOUNT_CENTS,
        dueDate: "2026-03-10",
      }),
    ],
  });
  return readSchedule(database, { orderId });
}

function regeneratedInstallment(input: {
  id: string;
  orderId: string;
  sequenceNumber: number;
  amountCents: number;
  dueDate: string;
}): { id: string; orderId: string; sequenceNumber: number; amountCents: number; dueDate: Date } {
  return { ...input, dueDate: new Date(input.dueDate) };
}

async function assertSeedPayments(database: DatabaseClient, payerId: string): Promise<void> {
  assert.deepEqual(await readPayments(database, payerId), [
    { amount: 1000, date: "2026-01-08", method: "PIX" },
    { amount: 1000, date: "2026-02-08", method: "PIX" },
    { amount: 1000, date: "2026-03-08", method: "PIX" },
    { amount: 1000, date: "2026-04-08", method: "PIX" },
    { amount: 1000, date: "2026-05-08", method: "PIX" },
  ]);
}

async function readPayments(
  database: DatabaseClient,
  payerId: string,
): Promise<Array<{ amount: number; date: string; method: string }>> {
  const payments = await database.paymentEntry.findMany({
    where: { payerId },
    orderBy: { date: "asc" },
  });
  return payments.map((row) => ({
    amount: row.amountCents,
    date: row.date.toISOString().slice(0, DATE_ONLY_LENGTH),
    method: row.method,
  }));
}

async function readPaymentLinks(
  database: DatabaseClient,
  payerId: string,
): Promise<
  Array<{
    paymentEntryId: string;
    installmentId: string;
    amountCents: number;
    date: string;
  }>
> {
  const allocations = await database.paymentAllocation.findMany({
    where: { paymentEntry: { payerId } },
    orderBy: { installmentId: "asc" },
    include: { paymentEntry: true },
  });
  return allocations.map((allocation) => ({
    paymentEntryId: allocation.paymentEntryId,
    installmentId: allocation.installmentId,
    amountCents: allocation.amountCents,
    date: allocation.paymentEntry.date.toISOString().slice(0, DATE_ONLY_LENGTH),
  }));
}

function seedFixture(
  database: DatabaseClient,
  input: { key: string; todayIso: string },
): { studentSeed: DevStudentSeed; context: SeedContext } {
  const studentSeed: DevStudentSeed = {
    key: input.key,
    fullName: "Sequence Seed Student",
    status: "ACTIVE",
    enrollments: [],
    attendance: "good",
    finance: "paid",
    tuitionCents: 1000,
  };
  const context: SeedContext = {
    database,
    todayIso: input.todayIso,
    teacherIds: new Map(),
    classes: new Map(),
    semester: {
      id: randomUUID(),
      name: "Seed",
      startIso: FIRST_HALF_START,
      endIso: "2026-06-01",
      year: 2026,
    },
  };
  return { studentSeed, context };
}

async function cleanSeedFixture(
  database: DatabaseClient,
  scope: { orderId: string; payerId: string; studentId: string },
): Promise<void> {
  const { orderId, payerId, studentId } = scope;
  await database.paymentAllocation.deleteMany({ where: { installment: { orderId } } });
  await database.paymentEntry.deleteMany({ where: { payerId } });
  await database.installment.deleteMany({ where: { orderId } });
  await database.orderBeneficiary.deleteMany({ where: { orderId } });
  await database.order.deleteMany({ where: { id: orderId } });
  await database.payer.deleteMany({ where: { id: payerId } });
  await database.student.delete({ where: { id: studentId } });
}

async function createSeedFixture(todayIso = "2026-06-01"): Promise<{
  database: DatabaseClient;
  studentSeed: DevStudentSeed;
  context: SeedContext;
  student: { id: string };
  orderId: string;
  payerId: string;
}> {
  const database = createDbClient();
  const key = `sequence-seed-${randomUUID()}`;
  const { studentSeed, context } = seedFixture(database, { key, todayIso });
  const student = await database.student.create({ data: { fullName: studentSeed.fullName } });
  const orderId = stableUuid(["order", key]);
  const payerId = stableUuid(["payer", key]);
  return { database, studentSeed, context, student, orderId, payerId };
}
