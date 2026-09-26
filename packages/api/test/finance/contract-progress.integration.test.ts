import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";

import { db, type Installment, type Order } from "@lazuli/db";
import type { CreateMonthlyContractInput } from "@lazuli/validators";

import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

type ContractListRow = Awaited<
  ReturnType<ReturnType<typeof finance>["listContracts"]>
>["rows"][number];

const PREFIX = "P08 progress ";
const NOW = new Date("2026-09-25T12:00:00Z");
const settings = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  punctualityDiscountPct: 0,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 0,
};

void before(async () => {
  await ensureAdminUser();
  await db.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settings },
    update: settings,
  });
});

void after(async () => {
  const payerWhere = { name: { startsWith: PREFIX } };
  const orders = await db.order.findMany({
    where: { OR: [{ payer: payerWhere }, { contract: { payer: payerWhere } }] },
    select: { id: true },
  });
  const orderId = { in: orders.map(({ id }) => id) };
  await db.paymentAllocation.deleteMany({ where: { installment: { orderId } } });
  await db.paymentEntry.deleteMany({ where: { payer: payerWhere } });
  await db.installmentAdjustment.deleteMany({ where: { installment: { orderId } } });
  await db.installment.deleteMany({ where: { orderId } });
  await db.orderBeneficiary.deleteMany({ where: { orderId } });
  await db.order.deleteMany({ where: { id: orderId } });
  await db.contract.deleteMany({ where: { payer: payerWhere } });
  await db.payer.deleteMany({ where: payerWhere });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.financeSettings.deleteMany({ where: { id: "singleton" } });
  await db.$disconnect();
});

async function fixture(
  name: string,
  { payerId, installmentCount = 12 }: { payerId?: string; installmentCount?: number } = {},
): Promise<{
  created: ContractListRow;
  order: Order & { installments: Installment[] };
  payer: { id: string };
  student: { id: string };
  values: CreateMonthlyContractInput;
}> {
  const payer = payerId
    ? { id: payerId }
    : await db.payer.create({ data: { name: `${PREFIX}${name}` } });
  const student = await db.student.create({
    data: { fullName: `${PREFIX}${name}`, status: "ACTIVE" },
  });
  const values = {
    commandId: randomUUID(),
    payerId: payer.id,
    studentId: student.id,
    agreedOn: "2026-01-01",
    startsOn: "2026-01-01",
    durationMonths: 12,
    monthlyAmountCents: 25_000,
    firstDueDate: "2026-01-10",
    installmentCount,
  };
  const created = await db.$transaction((tx) =>
    finance(tx, ADMIN.id).createMonthlyContract(values),
  );
  const order = await db.order.findFirstOrThrow({
    where: { contractId: created.id },
    include: { installments: { orderBy: { sequenceNumber: "asc" } } },
  });
  return { created, order, payer, student, values };
}

// Payment/waiver writes for contractual orders remain gated until P12–P15.
// Persist facts here to exercise the real derived read without opening those operations.
async function payment(
  payerId: string,
  {
    installmentId,
    amountCents,
    deleted = false,
  }: {
    installmentId: string;
    amountCents: number;
    deleted?: boolean;
  },
): Promise<void> {
  await db.paymentEntry.create({
    data: {
      payerId,
      date: NOW,
      amountCents,
      method: "PIX",
      allocations: {
        create: { installmentId, amountCents, deletedAt: deleted ? NOW : null },
      },
    },
  });
}

async function progress(id: string): Promise<ContractListRow["paymentProgress"]> {
  const list = await finance(db, ADMIN.id).listContracts({ page: 1, query: PREFIX, now: NOW });
  const row = list.rows.find((candidate) => candidate.id === id);
  assert.ok(row, "created contract must be listed");
  return row.paymentProgress;
}

void it("counts five fully paid installments and excludes a partial, material and sibling payments", async () => {
  const first = await fixture("Ana");
  const sibling = await fixture("Bia", { payerId: first.payer.id });
  for (const installment of first.order.installments.slice(0, 5)) {
    await payment(first.payer.id, { installmentId: installment.id, amountCents: 25_000 });
  }
  await payment(first.payer.id, {
    installmentId: first.order.installments[5]!.id,
    amountCents: 10_000,
  });
  await payment(first.payer.id, {
    installmentId: sibling.order.installments[0]!.id,
    amountCents: 25_000,
  });
  const material = await db.order.create({
    data: {
      payerId: first.payer.id,
      kind: "MATERIAL",
      principalAmountCents: 25_000,
      startDate: NOW,
      dueDay: 10,
      beneficiaries: { create: { studentId: first.student.id } },
      installments: { create: { sequenceNumber: 1, amountCents: 25_000, dueDate: NOW } },
    },
    include: { installments: true },
  });
  await payment(first.payer.id, {
    installmentId: material.installments[0]!.id,
    amountCents: 25_000,
  });
  assert.deepEqual(await progress(first.created.id), {
    paid: 5,
    total: 12,
    waived: 0,
    cancelled: 0,
  });
  assert.deepEqual(await progress(sibling.created.id), {
    paid: 1,
    total: 12,
    waived: 0,
    cancelled: 0,
  });
});

void it("keeps the original denominator for waivers and preserves paid installments after cancellation", async () => {
  const { created, order, payer, values } = await fixture("waivers");
  for (const installment of order.installments.slice(0, 5)) {
    await payment(payer.id, { installmentId: installment.id, amountCents: 25_000 });
  }
  await payment(payer.id, { installmentId: order.installments[5]!.id, amountCents: 10_000 });
  await db.installment.updateMany({
    where: { id: { in: order.installments.slice(5, 7).map(({ id }) => id) } },
    data: { waivedAt: NOW, waivedReason: "Dispensa acordada" },
  });
  assert.deepEqual(await progress(created.id), { paid: 5, total: 12, waived: 2, cancelled: 0 });
  await db.order.update({
    where: { id: order.id },
    data: { cancelledAt: NOW, cancelledReason: "Encerramento acordado" },
  });
  assert.deepEqual(await progress(created.id), { paid: 5, total: 12, waived: 2, cancelled: 5 });
  const replay = await db.$transaction((tx) => finance(tx, ADMIN.id).createMonthlyContract(values));
  assert.deepEqual(replay.paymentProgress, { paid: 5, total: 12, waived: 2, cancelled: 5 });
});

void it("uses the agreed installment count and distinguishes no payments, all waived and all paid", async () => {
  const { created, order, payer } = await fixture("special", { installmentCount: 3 });
  assert.deepEqual(created.paymentProgress, { paid: 0, total: 3, waived: 0, cancelled: 0 });
  await db.installment.updateMany({
    where: { orderId: order.id },
    data: { waivedAt: NOW, waivedReason: "Dispensa total" },
  });
  assert.deepEqual(await progress(created.id), { paid: 0, total: 3, waived: 3, cancelled: 0 });
  await db.installment.updateMany({
    where: { orderId: order.id },
    data: { waivedAt: null, waivedReason: null },
  });
  for (const installment of order.installments) {
    await payment(payer.id, { installmentId: installment.id, amountCents: 100_000 });
  }
  assert.deepEqual(await progress(created.id), { paid: 3, total: 3, waived: 0, cancelled: 0 });
});

void it("sums split payments and valid adjustments, ignoring deleted facts and zero without payment", async () => {
  const { created, order, payer } = await fixture("adjustments");
  const [split, interest, discount, reversed, zero, removed] = order.installments;
  await payment(payer.id, { installmentId: split!.id, amountCents: 10_000 });
  await payment(payer.id, { installmentId: split!.id, amountCents: 15_000 });
  await payment(payer.id, { installmentId: interest!.id, amountCents: 25_000 });
  await db.installmentAdjustment.createMany({
    data: [
      { installmentId: interest!.id, type: "INTEREST", amountCents: 1_000 },
      { installmentId: discount!.id, type: "DISCOUNT", amountCents: -2_000 },
      { installmentId: zero!.id, type: "DISCOUNT", amountCents: -25_000 },
      { installmentId: split!.id, type: "INTEREST", amountCents: 1_000, deletedAt: NOW },
    ],
  });
  await payment(payer.id, { installmentId: discount!.id, amountCents: 23_000 });
  await payment(payer.id, { installmentId: reversed!.id, amountCents: 25_000, deleted: true });
  await payment(payer.id, { installmentId: removed!.id, amountCents: 25_000 });
  await db.installment.update({ where: { id: removed!.id }, data: { deletedAt: NOW } });
  assert.deepEqual(await progress(created.id), { paid: 2, total: 12, waived: 0, cancelled: 0 });
  await payment(payer.id, { installmentId: interest!.id, amountCents: 1_000 });
  assert.deepEqual(await progress(created.id), { paid: 3, total: 12, waived: 0, cancelled: 0 });
});
