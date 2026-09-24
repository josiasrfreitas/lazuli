import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import { listContracts } from "../../src/finance/internal/contracts.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const prefix = "P05 contract integration ";
const settings = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 0,
};

void describe("monthly contract creation", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(async () => {
    const contracts = await db.contract.findMany({
      where: { payer: { name: { startsWith: prefix } } },
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
    await db.payer.deleteMany({ where: { name: { startsWith: prefix } } });
    await db.student.deleteMany({ where: { fullName: { startsWith: prefix } } });
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    await db.$disconnect();
  });

  void it("rolls back all rows, retries a committed command, and preserves offered conditions", async () => {
    const payer = await db.payer.create({ data: { name: `${prefix}payer` } });
    const student = await db.student.create({
      data: { fullName: `${prefix}student`, status: "ACTIVE" },
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
      durationMonths: 12,
      firstDueDate: "2026-01-31",
      monthlyAmountCents: 25_000,
      punctualityDiscountPct: 20,
    };
    await assert.rejects(
      db.$transaction(async (tx) => {
        await finance(tx, ADMIN.id).createMonthlyContract(values);
        throw new Error("simulated commit failure");
      }),
      /simulated commit failure/,
    );
    assert.equal(await db.contract.count({ where: { commandId: values.commandId } }), 0);

    const created = await db.$transaction((tx) =>
      finance(tx, ADMIN.id).createMonthlyContract(values),
    );
    assert.equal(created.principalAmountCents, 300_000);
    assert.equal(created.endsOn, "2027-03-15");
    assert.equal(created.installmentCount, 12);
    const order = await db.order.findFirstOrThrow({
      where: { contractId: created.id },
      include: { installments: { orderBy: { sequenceNumber: "asc" } } },
    });
    assert.deepEqual(
      order.installments.slice(0, 3).map((row) => row.dueDate.toISOString().slice(0, 10)),
      ["2026-01-31", "2026-02-28", "2026-03-31"],
    );

    await db.financeSettings.update({
      where: { id: "singleton" },
      data: { interestRatePctDaily: 0.5, maximumDiscountPct: 10 },
    });
    const replay = await db.$transaction((tx) =>
      finance(tx, ADMIN.id).createMonthlyContract(values),
    );
    assert.equal(replay.id, created.id);
    assert.equal(await db.contract.count({ where: { commandId: values.commandId } }), 1);
    await assert.rejects(
      db.$transaction((tx) =>
        finance(tx, ADMIN.id).createMonthlyContract({ ...values, monthlyAmountCents: 24_000 }),
      ),
      /dados diferentes/,
    );
    const persisted = await db.contract.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(Number(persisted.interestRatePctDaily), 0.1);
    assert.equal(Number(persisted.maximumDiscountPct), 20);
    const list = await finance(db, ADMIN.id).listContracts(1);
    assert.equal(list.rows.find((row) => row.id === created.id)?.payer.id, payer.id);
    const matching = await finance(db, ADMIN.id).listContracts(1, payer.name);
    assert.equal(
      matching.rows.find((row) => row.id === created.id)?.student.fullName,
      student.fullName,
    );
    const missing = await finance(db, ADMIN.id).listContracts(1, "sem aluno nem pagador");
    assert.equal(missing.total, 0);
    const onTime = await listContracts(db, 1, new Date("2026-01-31T12:00:00Z"));
    assert.equal(onTime.rows.find((row) => row.id === created.id)?.status, "EM_DIA");
    const overdue = await listContracts(db, 1, new Date("2026-02-02T12:00:00Z"));
    assert.equal(overdue.rows.find((row) => row.id === created.id)?.status, "INADIMPLENTE");
  });
});
