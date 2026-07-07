import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  callHttpMutation,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
  HTTP_OK,
} from "../db/finance-test-support.js";

const BATCH_HTTP_TEST_PREFIX = "GRE-46 HTTP ";
const HTTP_FIRST_INSTALLMENT_AMOUNT_CENTS = 33_333;

type BatchReconcileResponseBody = {
  result: {
    data: {
      json: {
        ok: boolean;
        paymentEntries: Array<{ id: string; payerId: string; amountCents: number }>;
        allocations: Array<{ installmentId: string; amountCents: number }>;
        rows: Array<{ installmentId: string; status: string; amountCents: number }>;
      };
    };
  };
};

void describe("finance batch reconcile API over the tRPC HTTP boundary", () => {
  registerFinanceBatchReconcileBehaviorHooks();
  registerFinanceBatchReconcileBehaviorHappyPath();
});

function registerFinanceBatchReconcileBehaviorHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(BATCH_HTTP_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(BATCH_HTTP_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerFinanceBatchReconcileBehaviorHappyPath(): void {
  databaseIt("batch reconciles an installment via HTTP", async () => {
    const payer = await createPayer("Http Batch Payer", BATCH_HTTP_TEST_PREFIX);
    const student = await createStudent("Http Batch Student", BATCH_HTTP_TEST_PREFIX);
    const order = await callHttpMutation({
      path: "finance.createOrder",
      body: {
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: payer.id },
        beneficiaryStudentIds: [student.id],
      },
    });
    const orderPayload = (await order.json()) as {
      result: { data: { json: { installments: Array<{ id: string }> } } };
    };
    const installmentId = orderPayload.result.data.json.installments[0]?.id ?? "";

    const response = await callHttpMutation({
      path: "finance.batchReconcile",
      body: {
        date: "2026-04-15",
        method: "PIX",
        externalReference: "GRE-46-HTTP-CORA",
        installmentIds: [installmentId],
      },
    });
    const payload = (await response.json()) as BatchReconcileResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.ok, true);
    assert.equal(payload.result.data.json.paymentEntries.length, 1);
    assert.equal(payload.result.data.json.paymentEntries[0]?.payerId, payer.id);
    assert.equal(
      payload.result.data.json.paymentEntries[0]?.amountCents,
      HTTP_FIRST_INSTALLMENT_AMOUNT_CENTS,
    );
    assert.deepEqual(
      payload.result.data.json.rows.map((row) => row.status),
      ["APPLIED"],
    );
    assert.equal(payload.result.data.json.allocations[0]?.installmentId, installmentId);

    const storedEntry = await db.paymentEntry.findUniqueOrThrow({
      where: { id: payload.result.data.json.paymentEntries[0]?.id },
      include: { allocations: true },
    });
    assert.equal(storedEntry.externalReference, "GRE-46-HTTP-CORA");
    assert.equal(storedEntry.allocations.length, 1);
    assert.equal(storedEntry.allocations[0]?.installmentId, installmentId);
  });
}
