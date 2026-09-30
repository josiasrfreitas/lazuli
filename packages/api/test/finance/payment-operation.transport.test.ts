import assert from "node:assert/strict";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import { callHttpMutation, callHttpQuery, ADMIN } from "../support/finance-test-support.js";
import {
  paymentFixture,
  paymentCommand,
  cleanPaymentOperations,
} from "../support/payment-operation.js";
const PREFIX = "P153 transport ";
void after(() => cleanPaymentOperations(PREFIX));

void it("serializes a real preview and safely retries a confirmed receipt through HTTP", async () => {
  const item = await paymentFixture(PREFIX);
  const query = await callHttpQuery({
    path: "finance.previewPayments",
    body: { date: "2026-02-10", items: [{ installmentId: item.installmentId }] },
  });
  assert.equal(query.status, 200);
  const preview = (await query.json()) as {
    result: { data: { json: Array<{ line: { quote: { settlementCents: number } } }> } };
  };
  assert.equal(preview.result.data.json[0]?.line.quote.settlementCents, 101_000);
  assert.equal(
    await db.paymentAllocation.count({ where: { installmentId: item.installmentId } }),
    0,
  );
  const command = await paymentCommand({ ...item, date: "2026-02-10" });
  const first = await callHttpMutation({ path: "finance.confirmPayments", body: command });
  const retry = await callHttpMutation({ path: "finance.confirmPayments", body: command });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  type Result = {
    result: { data: { json: Array<{ id: string; date: string; amountCents: number }> } };
  };
  const receipt = ((await first.json()) as Result).result.data.json[0];
  const replay = ((await retry.json()) as Result).result.data.json[0];
  assert.equal(receipt?.id, replay?.id);
  assert.equal(receipt?.date, "2026-02-10T00:00:00.000Z");
  assert.equal(receipt?.amountCents, 101_000);
  assert.equal(
    await db.paymentAllocation.count({ where: { installmentId: item.installmentId } }),
    1,
  );
});
void it("enforces authorization and allocation totals without leaving financial facts", async () => {
  const item = await paymentFixture(PREFIX);
  const command = await paymentCommand({ ...item, date: "2026-01-31" });
  for (const staffUser of [null, { ...ADMIN, role: "TEACHER" as const }]) {
    const result = await callHttpMutation({
      path: "finance.confirmPayments",
      body: command,
      staffUser,
    });
    assert.equal(result.status, staffUser === null ? 401 : 403);
    const body = (await result.json()) as { error: { json: { data: { code: string } } } };
    assert.equal(body.error.json.data.code, staffUser === null ? "UNAUTHORIZED" : "FORBIDDEN");
  }
  const mismatched = {
    ...command,
    receipts: command.receipts.map((receipt) => ({
      ...receipt,
      amountCents: receipt.amountCents + 1,
    })),
  };
  const invalid = await callHttpMutation({ path: "finance.confirmPayments", body: mismatched });
  assert.equal(invalid.status, 400);
  const error = (await invalid.json()) as { error: { json: { message: string } } };
  assert.match(error.error.json.message, /coincidir/);
  assert.equal(await db.paymentEntry.count({ where: { operationId: command.operationId } }), 0);
  assert.equal(
    await db.installmentAdjustment.count({ where: { installmentId: item.installmentId } }),
    0,
  );
});
