import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { FINANCE_DUE_DAY_FIFTH } from "@lazuli/domain";

import { db } from "@lazuli/db";

import { finance } from "../../src/finance/index.js";
import {
  ADMIN,
  cleanFinanceOrdersDatabase,
  createStudent,
  ensureAdminUser,
} from "../support/finance-test-support.js";

const PREFIX = "GRE-RCV ";
const INSTALLMENT_COUNT = 3;
const PRINCIPAL_CENTS = 90_000;
const PAST_START_DATE = new Date("2020-01-03T00:00:00.000Z");

/**
 * Proves the one-interface boundary from decision 0018: order creation and batch
 * reconciliation compose entirely through `finance(db, staffUserId)` —
 * no tRPC router, no HTTP boundary. If this can't be written against the module's
 * public surface alone, the module is not deep enough.
 */
void describe("finance module — end-to-end through one interface", { concurrency: 1 }, () => {
  registerHooks();
  registerCompositionTest();
});

function registerHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(PREFIX);
    await db.$disconnect();
  });
}

function registerCompositionTest(): void {
  void it("composes order creation with batch reconciliation through finance(db, staffUserId)", async () => {
    const student = await createStudent("batch-beneficiary", PREFIX);
    const created = await db.$transaction((tx) =>
      finance(tx, ADMIN.id).createOrder({
        kind: "TUITION",
        beneficiaryStudentIds: [student.id],
        principalAmountCents: PRINCIPAL_CENTS,
        installmentCount: INSTALLMENT_COUNT,
        startDate: PAST_START_DATE,
        dueDay: FINANCE_DUE_DAY_FIFTH,
        payer: { mode: "create", name: `${PREFIX}batch-payer` },
      }),
    );
    const installmentIds = created.installments.map((installment) => installment.id);

    const result = await db.$transaction((tx) =>
      finance(tx, ADMIN.id).batchReconcile({
        date: new Date(),
        method: "BOLETO",
        installmentIds,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.paymentEntries.length, 1);
    assert.equal(result.paymentEntries[0]?.amountCents, PRINCIPAL_CENTS);
  });
}
