import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { db } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { ADMIN } from "../support/finance-test-support.js";
import {
  PAYMENT_NOW,
  paymentFixture,
  paymentCommand,
  confirmPaymentCommand,
  cleanPaymentOperations,
} from "../support/payment-operation.js";
const PREFIX = "P153 integration ";
void after(() => cleanPaymentOperations(PREFIX));

void describe("payment operations", () => {
  void it("previews without writing and persists only incremental interest through successive partial receipts", async () => {
    const item = await paymentFixture(PREFIX);
    const first = await paymentCommand({ ...item, date: "2026-02-10", amountCents: 21_000 });
    await paymentCommand({ ...item, date: "2026-02-10", amountCents: 21_000 });
    assert.equal(
      await db.installmentAdjustment.count({ where: { installmentId: item.installmentId } }),
      0,
    );
    await confirmPaymentCommand(first);
    const second = await paymentCommand({ ...item, date: "2026-02-28", amountCents: 13_040 });
    await confirmPaymentCommand(second);
    const final = await paymentCommand({ ...item, date: "2026-03-31" });
    assert.equal(final.receipts[0]?.amountCents, 73_570);
    await confirmPaymentCommand(final);
    const adjustments = await db.installmentAdjustment.findMany({
      where: { installmentId: item.installmentId },
      orderBy: { effectiveDate: "asc" },
    });
    assert.deepEqual(
      adjustments.map((row) => row.amountCents),
      [1000, 3040, 3570],
    );
    const rows = await finance(db, ADMIN.id).installments(
      { view: "all", page: 1, pageSize: 25, search: PREFIX },
      PAYMENT_NOW,
    );
    assert.notEqual(rows.view, "overdue");
    if (rows.view === "overdue") throw new Error("Wrong query view");
    const paid = rows.rows.find((row) => row.installmentId === item.installmentId);
    assert.equal(paid?.collectibleBalanceCents, 0);
    assert.equal(paid?.paidAmountCents, 107_610);
    const contracts = await finance(db, ADMIN.id).listContracts({
      page: 1,
      payerId: item.payerId,
      now: PAYMENT_NOW,
    });
    assert.deepEqual(contracts.rows[0]?.paymentProgress, {
      paid: 1,
      total: 1,
      waived: 0,
      cancelled: 0,
    });
  });
  void it("replays a concurrent retry once and rejects a changed command payload", async () => {
    const item = await paymentFixture(PREFIX);
    const command = await paymentCommand({ ...item, date: "2026-01-31" });
    const [first, retry] = await Promise.all([
      confirmPaymentCommand(command),
      confirmPaymentCommand(command),
    ]);
    assert.equal(first[0]?.id, retry[0]?.id);
    assert.equal(await db.paymentEntry.count({ where: { operationId: command.operationId } }), 1);
    assert.equal(
      await db.installmentAdjustment.count({ where: { installmentId: item.installmentId } }),
      1,
    );
    await assert.rejects(confirmPaymentCommand({ ...command, method: "CASH" }), /outros dados/);
  });
  void it("rejects an entire multi-payer batch when one preview is stale", async () => {
    const first = await paymentFixture(PREFIX);
    const second = await paymentFixture(PREFIX);
    const left = await paymentCommand({ ...first, date: "2026-02-10" });
    const right = await paymentCommand({ ...second, date: "2026-02-10" });
    await confirmPaymentCommand(
      await paymentCommand({ ...second, date: "2026-02-10", amountCents: 1000 }),
    );
    const batch = { ...left, receipts: [...left.receipts, ...right.receipts] };
    await assert.rejects(confirmPaymentCommand(batch), /alterada/);
    assert.equal(
      await db.paymentAllocation.count({ where: { installmentId: first.installmentId } }),
      0,
    );
    assert.equal(
      await db.installmentAdjustment.count({ where: { installmentId: first.installmentId } }),
      0,
    );
    const fresh = await paymentCommand({ ...second, date: "2026-02-10" });
    const result = await confirmPaymentCommand({
      ...left,
      receipts: [...left.receipts, ...fresh.receipts],
    });
    assert.deepEqual(
      new Set(result.map((row) => row.payerId)),
      new Set([first.payerId, second.payerId]),
    );
  });
  void it("rolls back adjustments and receipts after failure and rejects retroactivity, surplus and future dates", async () => {
    const item = await paymentFixture(PREFIX);
    const command = await paymentCommand({ ...item, date: "2026-02-10", amountCents: 1000 });
    await assert.rejects(
      db.$transaction(async (tx) => {
        await finance(tx, ADMIN.id).confirmPayments(command, PAYMENT_NOW);
        throw new Error("forced rollback");
      }),
      /forced rollback/,
    );
    assert.equal(await db.paymentEntry.count({ where: { operationId: command.operationId } }), 0);
    assert.equal(
      await db.installmentAdjustment.count({ where: { installmentId: item.installmentId } }),
      0,
    );
    const excessive = await paymentCommand({ ...item, date: "2026-02-10", amountCents: 101_001 });
    await assert.rejects(confirmPaymentCommand(excessive), /não exceder/);
    await confirmPaymentCommand(command);
    const preview = await finance(db, ADMIN.id).previewPayments(
      { date: "2026-02-09", items: [{ installmentId: item.installmentId }] },
      PAYMENT_NOW,
    );
    assert.match(preview[0]?.error ?? "", /anterior/);
    const future = await finance(db, ADMIN.id).previewPayments(
      { date: "2026-10-01", items: [{ installmentId: item.installmentId }] },
      PAYMENT_NOW,
    );
    assert.match(future[0]?.error ?? "", /futura/);
  });
  void it("uses the same financial rules through the existing individual endpoint", async () => {
    const individual = await paymentFixture(PREFIX);
    const batched = await paymentFixture(PREFIX);
    const input = {
      commandId: randomUUID(),
      payerId: individual.payerId,
      date: new Date("2026-02-10T00:00:00Z"),
      amountCents: 21_000,
      method: "PIX" as const,
      allocations: [{ installmentId: individual.installmentId, amountCents: 21_000 }],
    };
    await db.$transaction((tx) => finance(tx, ADMIN.id).registerPayment(input));
    await confirmPaymentCommand(
      await paymentCommand({ ...batched, date: "2026-02-10", amountCents: 21_000 }),
    );
    const nextIndividual = await paymentCommand({ ...individual, date: "2026-02-28" });
    const nextBatch = await paymentCommand({ ...batched, date: "2026-02-28" });
    assert.equal(nextIndividual.receipts[0]?.amountCents, 83_040);
    assert.equal(nextBatch.receipts[0]?.amountCents, 83_040);
  });
});

void it("preserves separate receipts for the same payer and accepts mixed contract and Material origins", async () => {
  const first = await paymentFixture(PREFIX);
  const second = await paymentFixture(PREFIX, first.payerId);
  const material = await db.order.create({
    data: {
      payerId: first.payerId,
      kind: "MATERIAL",
      principalAmountCents: 10_000,
      startDate: new Date("2026-01-31"),
      dueDay: 10,
      installments: {
        create: { sequenceNumber: 1, dueDate: new Date("2026-01-31"), amountCents: 10_000 },
      },
    },
    include: { installments: true },
  });
  const firstReceipt = await paymentCommand({ ...first, date: "2026-01-31" });
  const secondReceipt = await paymentCommand({
    ...second,
    payerId: first.payerId,
    date: "2026-01-31",
  });
  const materialReceipt = await paymentCommand({
    installmentId: material.installments[0]!.id,
    payerId: first.payerId,
    date: "2026-01-31",
  });
  const command = {
    ...firstReceipt,
    receipts: [...firstReceipt.receipts, ...secondReceipt.receipts, ...materialReceipt.receipts],
  };
  const result = await confirmPaymentCommand(command);
  assert.equal(result.length, 3);
  assert.equal(new Set(result.map((receipt) => receipt.id)).size, 3);
  assert.deepEqual(new Set(result.map((receipt) => receipt.payerId)), new Set([first.payerId]));
  assert.deepEqual(
    result.map((receipt) => receipt.amountCents),
    [80_000, 80_000, 10_000],
  );
  const replay = await confirmPaymentCommand(command);
  assert.deepEqual(
    new Set(replay.map((receipt) => receipt.id)),
    new Set(result.map((receipt) => receipt.id)),
  );
});

void it("reads effective adjustment dates and legacy São Paulo dates before accruing through partial payments", async () => {
  const item = await paymentFixture(PREFIX);
  await db.installmentAdjustment.create({
    data: {
      installmentId: item.installmentId,
      type: "DISCOUNT",
      amountCents: -20_000,
      effectiveDate: new Date("2026-01-31"),
    },
  });
  await confirmPaymentCommand(
    await paymentCommand({ ...item, date: "2026-02-10", amountCents: 10_800 }),
  );
  await db.installmentAdjustment.create({
    data: {
      installmentId: item.installmentId,
      type: "CORRECTION",
      amountCents: 10_000,
      createdAt: new Date("2026-02-16T01:00:00Z"),
    },
  });
  await confirmPaymentCommand(
    await paymentCommand({ ...item, date: "2026-02-20", amountCents: 10_750 }),
  );
  const final = await paymentCommand({ ...item, date: "2026-02-28" });
  assert.equal(final.receipts[0]?.amountCents, 71_960);
  await confirmPaymentCommand(final);
  const interest = await db.installmentAdjustment.findMany({
    where: { installmentId: item.installmentId, type: "INTEREST" },
    orderBy: { effectiveDate: "asc" },
  });
  assert.deepEqual(
    interest.map((row) => row.amountCents),
    [800, 750, 1960],
  );
  const settled = await paymentCommand({ ...item, date: "2026-03-31" });
  assert.equal(settled.receipts[0]?.amountCents, 0);
});
