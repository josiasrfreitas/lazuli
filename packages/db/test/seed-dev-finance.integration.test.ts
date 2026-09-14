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
const INITIAL_SEQUENCE = [1, 2, THIRD, FOURTH, FIFTH];
const TUITION_CENTS = 1000;
const PRINCIPAL_CENTS = 5000;
const FIRST_HALF_END = "2026-06-01";
const DATE_ONLY_LENGTH = 10;
const FIRST_HALF_START = "2026-01-01";
const FIRST_HALF_DUE_DATES = ["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-10"];

type DatabaseClient = ReturnType<typeof createDbClient>;
type ScheduleWhere = { orderId: string };

// Recovery after edits/deletions and semester rollover is intentionally handled
// by pnpm db:reset, not by this development fixture loader.
for (const scenario of [
  {
    finance: "paid",
    todayIso: FIRST_HALF_END,
    paymentDates: ["2026-01-08", "2026-02-08", "2026-03-08", "2026-04-08", "2026-05-08"],
  },
  { finance: "overdue", todayIso: "2026-03-10", paymentDates: ["2026-01-08", "2026-02-08"] },
  { finance: "paid", todayIso: "2026-01-01", paymentDates: [] },
] as const) {
  void it(`seeds unchanged ${scenario.finance} fixtures at ${scenario.todayIso} without duplicating finance records`, async () => {
    const { database, studentSeed, context, student, orderId, payerId } = await createSeedFixture(
      scenario.todayIso,
    );
    studentSeed.finance = scenario.finance;
    try {
      await seedStudentFinance(context, { studentSeed, studentId: student.id });
      const first = await readSchedule(database, { orderId });
      assert.deepEqual(
        first.map((row) => row.sequenceNumber),
        INITIAL_SEQUENCE,
      );
      assert.deepEqual(
        first.map((row) => row.dueDate),
        FIRST_HALF_DUE_DATES,
      );
      assert.deepEqual(
        first.map((row) => row.amountCents),
        [TUITION_CENTS, TUITION_CENTS, TUITION_CENTS, TUITION_CENTS, TUITION_CENTS],
      );
      const order = await database.order.findUniqueOrThrow({ where: { id: orderId } });
      assert.equal(order.principalAmountCents, PRINCIPAL_CENTS);
      const links = await readPaymentLinks(database, payerId);
      assert.deepEqual(new Set(links.map((row) => row.date)), new Set(scenario.paymentDates));
      assert.deepEqual(
        links.map((row) => row.amountCents),
        scenario.paymentDates.map(() => TUITION_CENTS),
      );
      assert.deepEqual(
        new Set(links.map((row) => row.installmentId)),
        new Set(first.slice(0, scenario.paymentDates.length).map((row) => row.id)),
      );

      await seedStudentFinance(context, { studentSeed, studentId: student.id });

      assert.deepEqual(await readSchedule(database, { orderId }), first);
      assert.deepEqual(await readPaymentLinks(database, payerId), links);
      assert.deepEqual(
        await readPayments(database, payerId),
        scenario.paymentDates.map((date) => ({ amount: 1000, date, method: "PIX" })),
      );
    } finally {
      await cleanSeedFixture(database, { orderId, payerId, studentId: student.id });
      await database.$disconnect();
    }
  });
}

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
      endIso: FIRST_HALF_END,
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

async function createSeedFixture(todayIso: string): Promise<{
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
