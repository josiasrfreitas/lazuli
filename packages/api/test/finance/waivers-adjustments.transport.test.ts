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

const HTTP_TEST_PREFIX = "GRE-47 HTTP ";
const WAIVER_REASON = "Bolsa";
const DISCOUNT_REASON = "Desconto";
const DISCOUNT_AMOUNT_CENTS = -3000;

type WaiveResponseBody = {
  result: {
    data: {
      json: {
        installment: { id: string; waivedReason: string };
        ledger: { status: string; collectibleRemainingCents: number };
      };
    };
  };
};

type AdjustmentResponseBody = {
  result: {
    data: {
      json: {
        adjustment: { type: string; amountCents: number; reason: string | null };
        ledger: { status: string; currentExpectedCents: number };
      };
    };
  };
};

void describe("finance waiver and adjustment API over the tRPC HTTP boundary", () => {
  registerHttpHooks();
  registerWaiveHttpPath();
  registerDiscountHttpPath();
});

function registerHttpHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(HTTP_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(HTTP_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerWaiveHttpPath(): void {
  void it("waives an installment via HTTP", async () => {
    const installmentId = await createInstallmentId();

    const response = await callHttpMutation({
      path: "finance.waiveInstallment",
      body: { installmentId, reason: WAIVER_REASON },
    });
    const payload = (await response.json()) as WaiveResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.ledger.status, "WAIVED");
  });
}

function registerDiscountHttpPath(): void {
  void it("applies a discount adjustment via HTTP", async () => {
    const installmentId = await createInstallmentId();

    const response = await callHttpMutation({
      path: "finance.addInstallmentAdjustment",
      body: {
        installmentId,
        type: "DISCOUNT",
        amountCents: DISCOUNT_AMOUNT_CENTS,
        reason: DISCOUNT_REASON,
      },
    });
    const payload = (await response.json()) as AdjustmentResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.adjustment.type, "DISCOUNT");
  });
}

async function createInstallmentId(): Promise<string> {
  const payer = await createPayer("Http Waiver Payer", HTTP_TEST_PREFIX);
  const student = await createStudent("Http Waiver Student", HTTP_TEST_PREFIX);
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

  return orderPayload.result.data.json.installments[0]?.id ?? "";
}
