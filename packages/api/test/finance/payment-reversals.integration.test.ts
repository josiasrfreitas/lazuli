import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { loadSettlementItems, settlementLine } from "../../src/finance/internal/settlement-data.js";
import { ADMIN, caller, ensureAdminUser } from "../support/finance-test-support.js";
import {
  cleanPaymentOperations,
  confirmPaymentCommand,
  paymentCommand,
  paymentFixture,
} from "../support/payment-operation.js";

const PREFIX = "Payment reversal integration ";
const NOW = new Date("2026-09-30T12:00:00.000Z");

void before(ensureAdminUser);
void after(async () => {
  const paymentEntry = { payer: { name: { startsWith: PREFIX } } };
  await db.paymentReversalProof.deleteMany({ where: { reversal: { paymentEntry } } });
  await db.paymentReversalAllocation.deleteMany({ where: { reversal: { paymentEntry } } });
  await db.paymentReversal.deleteMany({ where: { paymentEntry } });
  await cleanPaymentOperations(PREFIX);
});

void it("reopens installment balance with partial cancellation and refund while preserving the receipt", async () => {
  const fixture = await paymentFixture(PREFIX);
  const [payment] = await confirmPaymentCommand(
    await paymentCommand({ ...fixture, date: "2026-01-31", amountCents: 12_000 }),
  );
  assert.ok(payment);
  const allocation = await db.paymentAllocation.findFirstOrThrow({
    where: { paymentEntryId: payment.id },
  });
  const firstCommand = {
    commandId: randomUUID(),
    paymentEntryId: payment.id,
    kind: "CANCELLATION" as const,
    allocations: [{ paymentAllocationId: allocation.id, amountCents: 4_000 }],
  };
  const cancelled = await caller().finance.reversePayment(firstCommand);
  const replay = await caller().finance.reversePayment(firstCommand);
  assert.equal(replay.id, cancelled.id);
  const refunded = await caller().finance.reversePayment({
    commandId: randomUUID(),
    paymentEntryId: payment.id,
    kind: "REFUND",
    occurredOn: new Date("2026-02-15T00:00:00.000Z"),
    refundMethod: "PIX",
    allocations: [{ paymentAllocationId: allocation.id, amountCents: 3_000 }],
  });
  assert.equal(refunded.amountCents, 3_000);
  const options = await caller().finance.paymentReversalOptions({ paymentEntryId: payment.id });
  assert.equal(options.allocations[0]?.availableAmountCents, allocation.amountCents - 7_000);
  assert.equal(options.reversals.length, 2);
  assert.equal(options.reversals.find((row) => row.id === refunded.id)?.occurredOn, "2026-02-15");
  const [item] = await loadSettlementItems(db, [fixture.installmentId]);
  assert.ok(item);
  const withoutRefund = {
    ...item,
    allocations: item.allocations.map((row) => ({
      ...row,
      reversals: row.reversals.filter((line) => line.reversal.kind === "CANCELLATION"),
    })),
  };
  const atRefund = settlementLine({ item, date: "2026-02-15", now: NOW });
  const beforeRefund = settlementLine({ item: withoutRefund, date: "2026-02-15", now: NOW });
  assert.equal(atRefund.quote.newInterestCents, beforeRefund.quote.newInterestCents);
  await assert.rejects(
    Promise.resolve().then(() => settlementLine({ item, date: "2026-02-14", now: NOW })),
    /data anterior a fato/u,
  );
  assert.equal(
    (await db.paymentEntry.findUniqueOrThrow({ where: { id: payment.id } })).amountCents,
    payment.amountCents,
  );
  assert.equal(
    (await db.paymentAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).amountCents,
    allocation.amountCents,
  );

  const contract = await db.contract.findUniqueOrThrow({ where: { id: fixture.contractId } });
  const list = await finance(db, ADMIN.id).installments(
    { studentId: contract.studentId, view: "all", page: 1, pageSize: 25 },
    NOW,
  );
  assert.ok("rows" in list);
  const row = list.rows.find((item) => item.installmentId === fixture.installmentId);
  assert.equal(row?.paidAmountCents, allocation.amountCents - 7_000);

  await assert.rejects(
    caller().finance.reversePayment({
      commandId: randomUUID(),
      paymentEntryId: payment.id,
      kind: "REFUND",
      occurredOn: new Date("2026-02-16T00:00:00.000Z"),
      refundMethod: "PIX",
      allocations: [{ paymentAllocationId: allocation.id, amountCents: allocation.amountCents }],
    }),
    /valor disponível/u,
  );
});
