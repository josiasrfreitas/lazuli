import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";

const NOW = new Date("2026-03-01T03:30:00.000Z");
const DUE = new Date("2026-02-10T00:00:00.000Z");
const PREFIX = "P04 Contract parties ";
const AMOUNT = 12_345;
const PAGE = { page: 1, pageSize: 10 } as const;

type Fixture = Awaited<ReturnType<typeof createReadFixture>>;

void describe("contract order parties", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(cleanup);
  registerReadTest();
  registerConstraintTest();
});

function registerReadTest(): void {
  void it("reads contractual parties in receivables and student totals while preserving historical siblings", async () => {
    const fixture = await createReadFixture();
    await assertInstallmentsRead(fixture);
    await assertStudentAndDashboardRead(fixture);
    await assertUnsupportedOperations(fixture);
  });
}

function registerConstraintTest(): void {
  void it("rejects conflicting party sources at the database boundary", async () => {
    const payer = await db.payer.create({ data: { name: `${PREFIX}constraint payer` } });
    const otherPayer = await db.payer.create({ data: { name: `${PREFIX}constraint other payer` } });
    const student = await db.student.create({
      data: { fullName: `${PREFIX}constraint student`, status: "ACTIVE" },
    });
    const contract = await db.contract.create({
      data: { payerId: payer.id, studentId: student.id },
    });
    const order = await db.order.create({
      data: {
        contractId: contract.id,
        kind: "CONTRACT",
        principalAmountCents: AMOUNT,
        startDate: DUE,
        dueDay: 10,
      },
    });
    await assert.rejects(
      db.orderBeneficiary.create({ data: { orderId: order.id, studentId: student.id } }),
      /Contract orders cannot have direct beneficiaries/,
    );
    await assert.rejects(
      db.contract.update({ where: { id: contract.id }, data: { payerId: otherPayer.id } }),
      /Contract parties with orders cannot be changed/,
    );
    await assert.rejects(
      db.order.create({
        data: {
          contractId: contract.id,
          payerId: payer.id,
          kind: "CONTRACT",
          principalAmountCents: AMOUNT,
          startDate: DUE,
          dueDay: 10,
        },
      }),
      /Order_party_source_check/,
    );
    await assert.rejects(
      db.order.create({
        data: { kind: "TUITION", principalAmountCents: AMOUNT, startDate: DUE, dueDay: 10 },
      }),
      /Order_party_source_check/,
    );
  });
}

async function createReadFixture(): Promise<{
  payer: { id: string; name: string };
  otherPayer: { id: string };
  student: { id: string; fullName: string };
  sibling: { id: string };
  contractualId: string;
  historicalId: string;
  installmentId: string;
}> {
  const payer = await db.payer.create({ data: { name: `${PREFIX}payer` } });
  const otherPayer = await db.payer.create({ data: { name: `${PREFIX}other payer` } });
  const student = await db.student.create({ data: { fullName: `${PREFIX}Ana`, status: "ACTIVE" } });
  const sibling = await db.student.create({ data: { fullName: `${PREFIX}Bia`, status: "ACTIVE" } });
  const contract = await db.contract.create({ data: { payerId: payer.id, studentId: student.id } });
  const contractual = await db.order.create({
    data: {
      contractId: contract.id,
      kind: "CONTRACT",
      principalAmountCents: AMOUNT,
      startDate: DUE,
      dueDay: 10,
      installments: { create: { sequenceNumber: 1, amountCents: AMOUNT, dueDate: DUE } },
    },
    include: { installments: true },
  });
  const historical = await db.order.create({
    data: {
      payerId: otherPayer.id,
      kind: "TUITION",
      principalAmountCents: AMOUNT,
      startDate: DUE,
      dueDay: 10,
      beneficiaries: { create: [{ studentId: student.id }, { studentId: sibling.id }] },
      installments: { create: { sequenceNumber: 1, amountCents: AMOUNT, dueDate: DUE } },
    },
  });
  const installmentId = contractual.installments[0]?.id;
  assert.ok(installmentId);
  return {
    payer,
    otherPayer,
    student,
    sibling,
    contractualId: contractual.id,
    historicalId: historical.id,
    installmentId,
  };
}

async function assertInstallmentsRead(fixture: Fixture): Promise<void> {
  const api = finance(db, ADMIN.id);
  const all = await api.installments({ view: "all", ...PAGE, search: PREFIX }, NOW);
  assert.strictEqual(all.view, "all");
  const contractRow = all.rows.find((row) => row.orderId === fixture.contractualId);
  const historicalRow = all.rows.find((row) => row.orderId === fixture.historicalId);
  assert.deepEqual(contractRow?.payer, { id: fixture.payer.id, name: fixture.payer.name });
  assert.deepEqual(contractRow?.beneficiaries, [
    { studentId: fixture.student.id, fullName: fixture.student.fullName },
  ]);
  assert.equal(contractRow?.origin, "CONTRACT");
  assert.deepEqual(
    new Set(historicalRow?.beneficiaries.map(({ studentId }) => studentId)),
    new Set([fixture.student.id, fixture.sibling.id]),
  );
  const byStudent = await api.installments({ view: "all", ...PAGE, search: `${PREFIX}Ana` }, NOW);
  assert.strictEqual(byStudent.view, "all");
  assert.deepEqual(
    new Set(byStudent.rows.map((row) => row.orderId)),
    new Set([fixture.contractualId, fixture.historicalId]),
  );
  const grouped = await api.installments({ view: "overdue", ...PAGE, search: PREFIX }, NOW);
  assert.strictEqual(grouped.view, "overdue");
  assert.equal(
    grouped.groups.find((group) => group.payer.id === fixture.payer.id)?.rows[0]?.orderId,
    fixture.contractualId,
  );
  assert.equal(
    grouped.groups.find((group) => group.payer.id === fixture.otherPayer.id)?.rows[0]?.orderId,
    fixture.historicalId,
  );
}

async function assertStudentAndDashboardRead(fixture: Fixture): Promise<void> {
  const api = finance(db, ADMIN.id);
  const totals = await api.studentOverdueTotals({
    studentIds: [fixture.student.id, fixture.sibling.id],
    now: NOW,
  });
  assert.deepEqual(totals, [
    { studentId: fixture.student.id, hasActiveOrder: true, overdueCents: AMOUNT * 2 },
    { studentId: fixture.sibling.id, hasActiveOrder: true, overdueCents: AMOUNT },
  ]);
  const list = await api.overdueList();
  assert.equal(
    list.rows.find((row) => row.orderId === fixture.contractualId)?.payer.id,
    fixture.payer.id,
  );
  assert.deepEqual(
    list.rows
      .find((row) => row.orderId === fixture.contractualId)
      ?.beneficiaries.map((row) => row.studentId),
    [fixture.student.id],
  );
  assert.equal(
    list.rows.find((row) => row.orderId === fixture.contractualId)?.ledger.interestPreviewCents,
    0,
  );
}

async function assertUnsupportedOperations(fixture: Fixture): Promise<void> {
  const api = finance(db, ADMIN.id);
  const allocation = [{ installmentId: fixture.installmentId, amountCents: AMOUNT }];
  await assert.rejects(
    api.registerPayment({
      payerId: fixture.otherPayer.id,
      date: DUE,
      amountCents: AMOUNT,
      method: "PIX",
      allocations: allocation,
    }),
    /outro pagador/,
  );
  await assert.rejects(
    api.registerPayment({
      payerId: fixture.payer.id,
      date: DUE,
      amountCents: AMOUNT,
      method: "PIX",
      allocations: allocation,
    }),
    /contratual ainda indisponivel/,
  );
  const batch = await api.batchReconcile({
    date: DUE,
    method: "PIX",
    installmentIds: [fixture.installmentId],
  });
  assert.equal(batch.ok, false);
  assert.match(batch.rows[0]?.reason ?? "", /contratual ainda nao aceita reconciliacao/);
  await assert.rejects(
    api.waiveInstallment({ installmentId: fixture.installmentId, reason: "teste" }),
    /contratual ainda indisponivel/,
  );
  await assert.rejects(
    api.addInstallmentAdjustment({
      installmentId: fixture.installmentId,
      type: "CORRECTION",
      amountCents: 1,
    }),
    /contratual ainda indisponivel/,
  );
  assert.equal(
    await db.paymentAllocation.count({ where: { installmentId: fixture.installmentId } }),
    0,
  );
}

async function cleanup(): Promise<void> {
  const orders = await db.order.findMany({
    where: {
      OR: [
        { contract: { payer: { name: { startsWith: PREFIX } } } },
        { payer: { name: { startsWith: PREFIX } } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map(({ id }) => id);
  await db.paymentAllocation.deleteMany({ where: { installment: { orderId: { in: orderIds } } } });
  await db.installmentAdjustment.deleteMany({
    where: { installment: { orderId: { in: orderIds } } },
  });
  await db.installment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderBeneficiary.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.contract.deleteMany({ where: { payer: { name: { startsWith: PREFIX } } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.payer.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.$disconnect();
}
