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

const THIRD_INSTALLMENT = 3;

type CreateOrderResponseBody = {
  result: {
    data: {
      json: {
        order: { id: string; principalAmountCents: number };
        installments: Array<{ amountCents: number; sequenceNumber: number }>;
      };
    };
  };
};

void describe("finance API over the tRPC HTTP boundary", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase();
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase();
    await db.$disconnect();
  });

  void it("creates an order with generated installments via HTTP", async () => {
    const payer = await createPayer("Http Payer");
    const student = await createStudent("Http Student");

    const response = await callHttpMutation({
      path: "finance.createOrder",
      body: {
        ...DEFAULT_ORDER_INPUT,
        payer: { mode: "existing", payerId: payer.id },
        beneficiaryStudentIds: [student.id],
      },
    });
    const payload = (await response.json()) as CreateOrderResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.deepEqual(
      payload.result.data.json.installments.map((row) => row.sequenceNumber),
      [1, 2, THIRD_INSTALLMENT],
    );
    assert.equal(
      payload.result.data.json.installments.length,
      DEFAULT_ORDER_INPUT.installmentCount,
    );
  });
});
