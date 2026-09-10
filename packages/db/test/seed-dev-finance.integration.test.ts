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

async function assertSeedPayments(
  database: ReturnType<typeof createDbClient>,
  payerId: string,
): Promise<void> {
  const payments = await database.paymentEntry.findMany({
    where: { payerId },
    orderBy: { date: "asc" },
  });
  assert.deepEqual(
    payments.map((row) => ({
      amount: row.amountCents,
      date: row.date.toISOString().slice(0, DATE_ONLY_LENGTH),
      method: row.method,
    })),
    [
      { amount: 1000, date: "2026-01-08", method: "PIX" },
      { amount: 1000, date: "2026-02-08", method: "PIX" },
      { amount: 1000, date: "2026-03-08", method: "PIX" },
      { amount: 1000, date: "2026-04-08", method: "PIX" },
      { amount: 1000, date: "2026-05-08", method: "PIX" },
    ],
  );
}

function seedFixture(
  database: ReturnType<typeof createDbClient>,
  key: string,
): { studentSeed: DevStudentSeed; context: SeedContext } {
  const studentSeed: DevStudentSeed = {
    key,
    fullName: "Sequence Seed Student",
    status: "ACTIVE",
    enrollments: [],
    attendance: "good",
    finance: "paid",
    tuitionCents: 1000,
  };
  const context: SeedContext = {
    database,
    todayIso: "2026-06-01",
    teacherIds: new Map(),
    classes: new Map(),
    semester: {
      id: randomUUID(),
      name: "Seed",
      startIso: "2026-01-01",
      endIso: "2026-06-01",
      year: 2026,
    },
  };
  return { studentSeed, context };
}

async function cleanSeedFixture(
  database: ReturnType<typeof createDbClient>,
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

async function createSeedFixture(): Promise<{
  database: ReturnType<typeof createDbClient>;
  studentSeed: DevStudentSeed;
  context: SeedContext;
  student: { id: string };
  orderId: string;
  payerId: string;
}> {
  const database = createDbClient();
  const key = `sequence-seed-${randomUUID()}`;
  const { studentSeed, context } = seedFixture(database, key);
  const student = await database.student.create({ data: { fullName: studentSeed.fullName } });
  const orderId = stableUuid(["order", key]);
  const payerId = stableUuid(["payer", key]);
  return { database, studentSeed, context, student, orderId, payerId };
}
