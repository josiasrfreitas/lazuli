import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";

import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const PREFIX = "P05 contract integration ";
const TERM_MONTHS = 12;
const PRINCIPAL_CENTS = 300_000;
const DAILY_INTEREST_PCT = 0.1;
const MAXIMUM_DISCOUNT_PCT = 20;
const DUE_SAMPLE_COUNT = 3;
const ON_TIME_INSTANT = new Date("2026-01-31T12:00:00Z");
const OVERDUE_INSTANT = new Date("2026-02-02T12:00:00Z");
const settings = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: MAXIMUM_DISCOUNT_PCT,
  interestRatePctDaily: DAILY_INTEREST_PCT,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 0,
};

async function cleanup(): Promise<void> {
  const contracts = await db.contract.findMany({
    where: { payer: { name: { startsWith: PREFIX } } },
    select: { id: true },
  });
  const ids = contracts.map((row) => row.id);
  const orders = await db.order.findMany({
    where: { contractId: { in: ids } },
    select: { id: true },
  });
  await db.installment.deleteMany({ where: { orderId: { in: orders.map((row) => row.id) } } });
  await db.order.deleteMany({ where: { contractId: { in: ids } } });
  await db.contract.deleteMany({ where: { id: { in: ids } } });
  await db.payer.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.financeSettings.deleteMany({ where: { id: "singleton" } });
  await db.$disconnect();
}

async function fixture(): Promise<{
  payer: { id: string; name: string };
  student: { id: string; fullName: string };
  values: CreateMonthlyContractInput;
}> {
  const payer = await db.payer.create({ data: { name: `${PREFIX}payer` } });
  const student = await db.student.create({
    data: { fullName: `${PREFIX}student`, status: "ACTIVE" },
  });
  await db.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settings },
    update: settings,
  });
  const values = {
    commandId: randomUUID(),
    payerId: payer.id,
    studentId: student.id,
    agreedOn: "2026-03-15",
    startsOn: "2026-03-15",
    durationMonths: TERM_MONTHS,
    firstDueDate: "2026-01-31",
    monthlyAmountCents: 25_000,
    punctualityDiscountPct: MAXIMUM_DISCOUNT_PCT,
  };
  return { payer, student, values };
}

async function creationIsAtomicAndStable(): Promise<void> {
  const { values } = await fixture();
  await assert.rejects(
    db.$transaction(async (transaction) => {
      await finance(transaction, ADMIN.id).createMonthlyContract(values);
      throw new Error("simulated commit failure");
    }),
    /simulated commit failure/,
  );
  assert.equal(await db.contract.count({ where: { commandId: values.commandId } }), 0);
  const created = await db.$transaction((transaction) =>
    finance(transaction, ADMIN.id).createMonthlyContract(values),
  );
  assert.equal(created.principalAmountCents, PRINCIPAL_CENTS);
  assert.equal(created.endsOn, "2027-03-15");
  assert.equal(created.installmentCount, TERM_MONTHS);
  const order = await db.order.findFirstOrThrow({
    where: { contractId: created.id },
    include: { installments: { orderBy: { sequenceNumber: "asc" } } },
  });
  assert.deepEqual(
    order.installments
      .slice(0, DUE_SAMPLE_COUNT)
      .map((row) => row.dueDate.toISOString().split("T")[0]),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  await db.financeSettings.update({
    where: { id: "singleton" },
    data: { interestRatePctDaily: 0.5, maximumDiscountPct: 10 },
  });
  const replay = await db.$transaction((transaction) =>
    finance(transaction, ADMIN.id).createMonthlyContract(values),
  );
  assert.equal(replay.id, created.id);
  assert.equal(await db.contract.count({ where: { commandId: values.commandId } }), 1);
  await assert.rejects(
    db.$transaction((transaction) =>
      finance(transaction, ADMIN.id).createMonthlyContract({
        ...values,
        monthlyAmountCents: 24_000,
      }),
    ),
    /dados diferentes/,
  );
  const persisted = await db.contract.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(Number(persisted.interestRatePctDaily), DAILY_INTEREST_PCT);
  assert.equal(Number(persisted.maximumDiscountPct), MAXIMUM_DISCOUNT_PCT);
}

async function listingSearchAndStatus(): Promise<void> {
  const { payer, student, values } = await fixture();
  const created = await db.$transaction((transaction) =>
    finance(transaction, ADMIN.id).createMonthlyContract(values),
  );
  const list = await finance(db, ADMIN.id).listContracts({ page: 1 });
  assert.equal(list.rows.find((row) => row.id === created.id)?.payer.id, payer.id);
  const matching = await finance(db, ADMIN.id).listContracts({ page: 1, query: payer.name });
  assert.equal(
    matching.rows.find((row) => row.id === created.id)?.student.fullName,
    student.fullName,
  );
  const missing = await finance(db, ADMIN.id).listContracts({
    page: 1,
    query: "sem aluno nem pagador",
  });
  assert.equal(missing.total, 0);
  const onTime = await finance(db, ADMIN.id).listContracts({ page: 1, now: ON_TIME_INSTANT });
  assert.equal(onTime.rows.find((row) => row.id === created.id)?.status, "EM_DIA");
  const overdue = await finance(db, ADMIN.id).listContracts({ page: 1, now: OVERDUE_INSTANT });
  assert.equal(overdue.rows.find((row) => row.id === created.id)?.status, "INADIMPLENTE");
  await db.installment.updateMany({
    where: { order: { contractId: created.id } },
    data: { waivedAt: OVERDUE_INSTANT },
  });
  const waived = await finance(db, ADMIN.id).listContracts({ page: 1, now: OVERDUE_INSTANT });
  assert.equal(waived.rows.find((row) => row.id === created.id)?.status, "EM_DIA");
}

void describe("monthly contract creation", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(cleanup);
  void it(
    "rolls back, retries once, and preserves financial conditions",
    creationIsAtomicAndStable,
  );
  void it(
    "searches and derives payment status without counting waivers as paid",
    listingSearchAndStatus,
  );
});
