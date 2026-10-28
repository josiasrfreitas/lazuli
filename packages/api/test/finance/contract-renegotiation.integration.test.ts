import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { db, type TransactionClient } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import {
  confirmContractRenegotiation,
  previewContractRenegotiation,
  contractRenegotiationOptions,
} from "../../src/finance/internal/contract-renegotiation.js";
import { readStudentSummary } from "../../src/finance/internal/student-summary.js";

const now = new Date("2026-02-15T15:00:00Z");
after(() => db.$disconnect());

async function fixture(tx: TransactionClient) {
  const actor = await tx.user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.test`,
      name: "Renegotiation integration",
      role: "ADMIN",
      isEnabled: true,
    },
  });
  const student = await tx.student.create({
    data: { fullName: "Renegotiation integration student", status: "ACTIVE" },
  });
  const payer = await tx.payer.create({ data: { name: "Renegotiation integration payer" } });
  const settings = {
    tuitionCeilingCents: 30_000,
    maximumDiscountPct: 20,
    punctualityDiscountPct: 0,
    interestRatePctDaily: 0,
    interestRatePctMonthly: 0,
    cancellationFeePct: 20,
    materialPriceCents: 0,
  };
  await tx.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settings },
    update: settings,
  });
  const contract = await finance(tx, actor.id).createMonthlyContract({
    commandId: randomUUID(),
    studentId: student.id,
    payerId: payer.id,
    agreedOn: "2026-01-01",
    startsOn: "2026-01-01",
    durationMonths: 4,
    firstDueDate: "2026-01-10",
    monthlyAmountCents: 30_000,
  });
  const installments = await tx.installment.findMany({
    where: { order: { contractId: contract.id } },
    orderBy: { sequenceNumber: "asc" },
  });
  return { actor, student, payer, contract, installments };
}

async function rollback(work: (tx: TransactionClient) => Promise<void>): Promise<void> {
  const sentinel = new Error("rollback renegotiation fixture");
  await assert.rejects(
    db.$transaction(
      async (tx) => {
        await work(tx);
        throw sentinel;
      },
      { timeout: 30_000 },
    ),
    (error) => error === sentinel,
  );
}

test("selected installments change atomically, preserving receipts and replaying the same confirmation once", async () => {
  await rollback(async (tx) => {
    const { actor, student, payer, contract, installments } = await fixture(tx);
    await tx.paymentEntry.create({
      data: {
        payerId: payer.id,
        date: new Date("2026-01-10T00:00:00Z"),
        amountCents: 5_000,
        method: "PIX",
        createdById: actor.id,
        updatedById: actor.id,
        allocations: {
          create: {
            installmentId: installments[0]!.id,
            amountCents: 5_000,
            createdById: actor.id,
            updatedById: actor.id,
          },
        },
      },
    });
    const request = {
      contractId: contract.id,
      installmentIds: [installments[0]!.id, installments[2]!.id],
      newAmountCents: 10_000,
    };
    const preview = await previewContractRenegotiation(tx, request, now);
    assert.equal(preview.reductionCents, 40_000);
    const values = {
      ...request,
      commandId: randomUUID(),
      version: preview.version,
      reason: "Exceção acordada com o responsável",
      acknowledged: true as const,
    };
    await confirmContractRenegotiation({ database: tx, values, actor, now });
    await confirmContractRenegotiation({ database: tx, values, actor, now });
    assert.equal(await tx.contractRenegotiation.count({ where: { contractId: contract.id } }), 1);
    const after = await contractRenegotiationOptions(tx, contract.id, now);
    assert.deepEqual(
      after.lines.map((line) => line.balanceCents),
      [5_000, 30_000, 10_000, 30_000],
    );
    const summary = await readStudentSummary(tx, { studentId: student.id, now });
    assert.equal(summary.receivedCents, 5_000);
    assert.equal(summary.outstandingCents, 75_000);
    assert.equal(summary.contracts[0]!.schedules[0]!.totalCents, 80_000);
    assert.equal(summary.contracts[0]!.schedules[0]!.uniformAmountCents, null);
    const original = await tx.installment.findUniqueOrThrow({ where: { id: installments[0]!.id } });
    assert.equal(original.amountCents, 30_000);
    assert.equal(
      (await tx.contract.findUniqueOrThrow({ where: { id: contract.id } })).terminatedAt,
      null,
    );
    await assert.rejects(
      confirmContractRenegotiation({
        database: tx,
        values: { ...values, newAmountCents: 1 },
        actor,
        now,
      }),
      /outra renegociação/,
    );
  });
});

test("stale previews and cross-contract selections cannot create an agreement", async () => {
  await rollback(async (tx) => {
    const { actor, contract, installments } = await fixture(tx);
    const request = {
      contractId: contract.id,
      installmentIds: [installments[0]!.id],
      newAmountCents: 0,
    };
    const preview = await previewContractRenegotiation(tx, request, now);
    await tx.installment.update({
      where: { id: installments[0]!.id },
      data: { dueDate: new Date("2026-01-11T00:00:00Z") },
    });
    await assert.rejects(
      confirmContractRenegotiation({
        database: tx,
        actor,
        now,
        values: {
          ...request,
          commandId: randomUUID(),
          version: preview.version,
          reason: "Redução de último recurso",
          acknowledged: true,
        },
      }),
      /parcelas mudaram/,
    );
    await assert.rejects(
      previewContractRenegotiation(tx, { ...request, installmentIds: [randomUUID()] }, now),
      /deste contrato/,
    );
    assert.equal(await tx.contractRenegotiation.count({ where: { contractId: contract.id } }), 0);
    assert.equal(
      await tx.installmentAdjustment.count({ where: { installmentId: installments[0]!.id } }),
      0,
    );
  });
});
