import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, it } from "node:test";
import { db, type TransactionClient } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";

void after(() => db.$disconnect());
const NOW = new Date("2026-03-02T02:30:00Z");

async function rollback(work: (tx: TransactionClient) => Promise<void>): Promise<void> {
  const sentinel = new Error("rollback invoice installments fixture");
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

void it("scopes invoice installments, keeps ledger adjustments and exposes only active receipt proofs", async () => {
  await rollback(async (tx) => {
    const actor = await tx.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        name: "Invoice test",
        role: "ADMIN",
        isEnabled: true,
      },
    });
    const student = await tx.student.create({ data: { fullName: "Invoice test student" } });
    const payer = await tx.payer.create({ data: { name: "Invoice test payer" } });
    const method = await tx.paymentMethod.create({
      data: { code: randomUUID(), name: "Invoice transfer" },
    });
    const contract = await tx.contract.create({
      data: { studentId: student.id, payerId: payer.id },
    });
    const order = await tx.order.create({
      data: {
        contractId: contract.id,
        kind: "TUITION",
        principalAmountCents: 75_000,
        startDate: new Date("2026-01-01"),
        dueDay: 5,
        installments: {
          create: [
            { sequenceNumber: 3, dueDate: new Date("2026-04-05"), amountCents: 25_000 },
            { sequenceNumber: 1, dueDate: new Date("2026-01-05"), amountCents: 25_000 },
            { sequenceNumber: 2, dueDate: new Date("2026-02-05"), amountCents: 25_000 },
          ],
        },
      },
      include: { installments: { orderBy: { sequenceNumber: "asc" } } },
    });
    const [first, second, third] = order.installments;
    assert.ok(first && second && third);
    const unrelated = await tx.order.create({
      data: {
        contractId: contract.id,
        kind: "ENROLLMENT_FEE",
        principalAmountCents: 900,
        startDate: new Date("2026-01-01"),
        dueDay: 5,
        installments: {
          create: { sequenceNumber: 1, dueDate: new Date("2026-01-05"), amountCents: 900 },
        },
      },
    });
    await tx.installmentAdjustment.create({
      data: {
        installmentId: first.id,
        type: "DISCOUNT",
        amountCents: -2_500,
      },
    });
    const payment = await tx.paymentEntry.create({
      data: {
        payerId: payer.id,
        method: method.code,
        date: new Date("2026-01-05"),
        amountCents: 22_500,
        allocations: { create: { installmentId: first.id, amountCents: 22_500 } },
      },
    });
    const proof = await tx.paymentProof.create({
      data: {
        paymentEntryId: payment.id,
        uploadedById: actor.id,
        fileName: "receipt.pdf",
        contentType: "application/pdf",
        byteLength: 128,
        sha256: "a".repeat(64),
        bucket: "invoice-test",
        key: randomUUID(),
      },
    });
    await tx.paymentProof.create({
      data: {
        paymentEntryId: payment.id,
        uploadedById: actor.id,
        fileName: "removed.pdf",
        contentType: "application/pdf",
        byteLength: 128,
        sha256: "b".repeat(64),
        bucket: "invoice-test",
        key: randomUUID(),
        deletedAt: NOW,
      },
    });
    await tx.paymentEntry.create({
      data: {
        payerId: payer.id,
        method: method.code,
        date: new Date("2026-02-05"),
        amountCents: 10_000,
        allocations: { create: { installmentId: second.id, amountCents: 10_000 } },
      },
    });
    const cancelled = await tx.paymentEntry.create({
      data: {
        payerId: payer.id,
        method: method.code,
        date: new Date("2026-02-05"),
        amountCents: 25_000,
        allocations: { create: { installmentId: third.id, amountCents: 25_000 } },
      },
      include: { allocations: true },
    });
    await tx.paymentReversal.create({
      data: {
        paymentEntryId: cancelled.id,
        commandId: randomUUID(),
        commandFingerprint: "invoice-test",
        kind: "CANCELLATION",
        reason: "Cancelled test receipt",
        occurredOn: new Date("2026-02-06"),
        amountCents: 25_000,
        createdById: actor.id,
        allocations: {
          create: { paymentAllocationId: cancelled.allocations[0]!.id, amountCents: 25_000 },
        },
      },
    });

    const result = await finance(tx, actor.id).contractInstallments({
      orderId: order.id,
      now: NOW,
    });
    assert.equal(result.asOf, "2026-03-01");
    assert.deepEqual(
      result.rows.map((row) => ({
        id: row.installmentId,
        sequence: row.sequenceNumber,
        status: row.status,
        amount: row.expectedAmountCents,
        paid: row.paidAmountCents,
        balance: row.collectibleBalanceCents,
        hasPayments: row.hasPayments,
        proofs: row.proofs,
      })),
      [
        {
          id: first.id,
          sequence: 1,
          status: "PAID",
          amount: 22_500,
          paid: 22_500,
          balance: 0,
          hasPayments: true,
          proofs: [{ id: proof.id, fileName: "receipt.pdf", byteLength: 128 }],
        },
        {
          id: second.id,
          sequence: 2,
          status: "OVERDUE",
          amount: 25_000,
          paid: 10_000,
          balance: 15_000,
          hasPayments: true,
          proofs: [],
        },
        {
          id: third.id,
          sequence: 3,
          status: "UPCOMING",
          amount: 25_000,
          paid: 0,
          balance: 25_000,
          hasPayments: false,
          proofs: [],
        },
      ],
    );
    await assert.rejects(
      finance(tx, actor.id).contractInstallments({ orderId: unrelated.id, now: NOW }),
      { code: "NOT_FOUND" },
    );
  });
});
