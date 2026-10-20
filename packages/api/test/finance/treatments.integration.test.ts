import assert from "node:assert/strict";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import type { FinancialTreatmentConfirm, FinancialTreatmentPreview } from "@lazuli/validators";
import { finance } from "../../src/finance/index.js";
import { ADMIN } from "../support/finance-test-support.js";
import {
  paymentFixture,
  paymentCommand,
  confirmPaymentCommand,
  cleanPaymentOperations,
} from "../support/payment-operation.js";
import {
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";

const PREFIX = "Treatments #202 ";
const NOW = new Date("2026-02-10T12:00:00Z");
void after(async () => {
  await db.installmentAgreement.deleteMany({
    where: { installment: { order: { contract: { payer: { name: { startsWith: PREFIX } } } } } },
  });
  await cleanPaymentOperations(PREFIX);
  await cleanInstallmentsTestData();
  await db.$disconnect();
});
async function agreement(request: FinancialTreatmentPreview): Promise<FinancialTreatmentConfirm> {
  const preview = await finance(db, ADMIN.id).previewTreatment(request, NOW);
  return {
    ...request,
    reason: "Prazo combinado com o responsável",
    commandId: crypto.randomUUID(),
    version: preview.version,
  };
}
function confirm(values: FinancialTreatmentConfirm): Promise<{ count: number }> {
  return db.$transaction((transaction) =>
    finance(transaction, ADMIN.id).confirmTreatment(values, { actorName: ADMIN.name, now: NOW }),
  );
}
const choice = (id: string): FinancialTreatmentPreview => ({
  rows: [{ installmentId: id, reductionCents: 500, forgiveCharges: false }],
});
void it("persists one audited agreement on concurrent retry and preserves principal through suspension and later receipts", async () => {
  const item = await paymentFixture(PREFIX);
  const contract = await db.contract.findUniqueOrThrow({ where: { id: item.contractId } });
  const request = {
    studentId: contract.studentId,
    rows: [{ installmentId: item.installmentId, reductionCents: 500, forgiveCharges: false }],
    newDueDate: "2026-02-20",
  };
  const command = await agreement(request);
  assert.equal(
    await db.installmentAgreement.count({ where: { installmentId: item.installmentId } }),
    0,
  );
  const [first, retry] = await Promise.all([confirm(command), confirm(command)]);
  assert.deepEqual(first, { count: 1 });
  assert.deepEqual(retry, first);
  const saved = await db.installment.findUniqueOrThrow({
    where: { id: item.installmentId },
    include: { agreements: true, adjustments: true },
  });
  assert.equal(saved.amountCents, 100_000);
  assert.equal(saved.dueDate.toISOString().slice(0, 10), "2026-02-20");
  assert.equal(saved.suspendedUntil?.toISOString().slice(0, 10), "2026-02-20");
  assert.equal(saved.agreements.length, 1);
  assert.deepEqual(
    saved.adjustments
      .map((row) => ({ type: row.type, amount: row.amountCents, charges: row.chargeOnly }))
      .toSorted((left, right) => left.amount - right.amount),
    [
      { type: "CORRECTION", amount: -500, charges: true },
      { type: "INTEREST", amount: 1000, charges: false },
    ],
  );
  const history = await finance(db, ADMIN.id).treatmentHistory(contract.studentId);
  assert.equal(history[0]?.reason, command.reason);
  assert.equal(history[0]?.actorId, ADMIN.id);
  assert.equal(history[0]?.actorName, ADMIN.name);
  assert.equal(history[0]?.previousChargesCents, 1000);
  assert.equal(history[0]?.previousBalanceCents, 101_000);
  assert.equal(history[0]?.previousDueDate.toISOString().slice(0, 10), "2026-01-31");
  const before = await paymentCommand({ ...item, date: "2026-02-15", amountCents: 20_500 });
  await confirmPaymentCommand(before);
  const later = await paymentCommand({ ...item, date: "2026-02-25" });
  // 1000 charges accrued before suspension, 500 forgiven, 500 paid with the partial receipt.
  // The remaining 80,000 principal accrues five days at 0.1% after February 20: 400.
  assert.equal(later.receipts[0]?.amountCents, 80_400);
  await confirmPaymentCommand(later);
  const summary = await finance(db, ADMIN.id).studentSummary({
    studentId: contract.studentId,
    now: new Date("2026-02-25T12:00:00Z"),
  });
  assert.equal(summary.outstandingCents, 0);
  assert.equal(summary.receivedCents, 100_900);
  const persistedHistory = await finance(db, ADMIN.id).treatmentHistory(contract.studentId);
  assert.equal(persistedHistory.length, 1);
  await assert.rejects(confirm({ ...command, reason: "Outra negociação" }), /outra tratativa/);
});
void it("rejects stale or principal-reducing previews and serializes command collisions across disjoint batches", async () => {
  const left = await paymentFixture(PREFIX);
  const right = await paymentFixture(PREFIX);

  const stale = await agreement(choice(left.installmentId));
  await confirmPaymentCommand(
    await paymentCommand({ ...left, date: "2026-02-10", amountCents: 100 }),
  );
  await assert.rejects(confirm(stale), /mudaram/);
  assert.equal(
    await db.installmentAgreement.count({ where: { installmentId: left.installmentId } }),
    0,
  );
  await assert.rejects(
    finance(db, ADMIN.id).previewTreatment(
      {
        rows: [{ installmentId: right.installmentId, reductionCents: 1001, forgiveCharges: false }],
      },
      NOW,
    ),
    /maior que os encargos/,
  );
  const student = await db.contract.findUniqueOrThrow({ where: { id: right.contractId } });
  await assert.rejects(
    finance(db, ADMIN.id).previewTreatment(
      { ...choice(left.installmentId), studentId: student.studentId },
      NOW,
    ),
    /deste aluno/,
  );
  await assert.rejects(
    finance(db, ADMIN.id).previewTreatment(
      { ...choice(right.installmentId), newDueDate: "2026-02-10" },
      NOW,
    ),
    /posterior a hoje/,
  );
  const command = await agreement(choice(left.installmentId));
  const other = { ...(await agreement(choice(right.installmentId))), commandId: command.commandId };
  const results = await Promise.allSettled([confirm(command), confirm(other)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.match(String(rejected.reason), /outra tratativa/);
  assert.equal(await db.installmentAgreement.count({ where: { commandId: command.commandId } }), 1);
});
void it("paginates scoped choices and finds initial selections outside the first page without leaking a shared payer", async () => {
  const target = await createInstallmentOrder({ installmentCount: 51, dueDate: "2026-01-31" });
  const other = await createInstallmentOrder({ installmentCount: 3, dueDate: "2026-01-31" });
  await db.order.update({ where: { id: other.orderId }, data: { payerId: target.payerId } });
  const studentId = target.studentIds[0];
  assert.ok(studentId);
  const first = await finance(db, ADMIN.id).treatmentInstallments({ studentId }, NOW);
  assert.equal(first.rows.length, 50);
  assert.equal(first.nextCursor, 2);
  const second = await finance(db, ADMIN.id).treatmentInstallments(
    { studentId, cursor: first.nextCursor },
    NOW,
  );
  assert.equal(second.rows.length, 1);
  assert.equal(second.nextCursor, null);
  const id = second.rows[0]?.id;
  assert.ok(id);
  assert.equal(
    first.rows.some((row) => row.id === id),
    false,
  );
  const initial = await finance(db, ADMIN.id).treatmentInstallments(
    { studentId, installmentIds: [id] },
    NOW,
  );
  assert.deepEqual(
    initial.rows.map((row) => row.id),
    [id],
  );
  assert.equal(
    [...first.rows, ...second.rows].every((row) => target.installmentIds.includes(row.id)),
    true,
  );
  await db.student.update({ where: { id: studentId }, data: { deletedAt: NOW } });
  assert.deepEqual(await finance(db, ADMIN.id).treatmentInstallments({ studentId }, NOW), {
    rows: [],
    nextCursor: null,
  });
});
