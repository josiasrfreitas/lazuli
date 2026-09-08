import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  callHttpMutation,
  cleanFinanceOrdersDatabase,
  createPayer,
  createStudent,
  DEFAULT_ORDER_INPUT,
  ensureAdminUser,
  HTTP_OK,
} from "../support/finance-test-support.js";

const PAYMENT_HTTP_TEST_PREFIX = "GRE-44 HTTP ";
const HTTP_PAYMENT_AMOUNT_CENTS = 40_000;
const HTTP_ALLOCATION_AMOUNT_CENTS = 30_000;

type RegisterPaymentResponseBody = {
  result: {
    data: {
      json: {
        paymentEntry: { id: string; payerId: string; amountCents: number; method: string };
        allocations: Array<{ installmentId: string; amountCents: number }>;
        unallocatedRemainderCents: number;
      };
    };
  };
};

void describe("finance payment API over the tRPC HTTP boundary", () => {
  registerFinancePaymentBehaviorHooks();
  registerFinancePaymentBehaviorHappyPath();
});

function registerFinancePaymentBehaviorHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(PAYMENT_HTTP_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(PAYMENT_HTTP_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerFinancePaymentBehaviorHappyPath(): void {
  void it("registers a payment and allocation via HTTP", async () => {
    const payer = await createPayer("Http Payment Payer", PAYMENT_HTTP_TEST_PREFIX);
    const student = await createStudent("Http Payment Student", PAYMENT_HTTP_TEST_PREFIX);
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
      path: "finance.registerPayment",
      body: {
        payerId: payer.id,
        date: "2026-04-10",
        amountCents: HTTP_PAYMENT_AMOUNT_CENTS,
        method: "PIX",
        allocations: [{ installmentId, amountCents: HTTP_ALLOCATION_AMOUNT_CENTS }],
      },
    });
    const payload = (await response.json()) as RegisterPaymentResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(
      payload.result.data.json.allocations[0]?.amountCents,
      HTTP_ALLOCATION_AMOUNT_CENTS,
    );
  });
}
