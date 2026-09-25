import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  callHttpMutation,
  callHttpQuery,
  ensureAdminUser,
} from "../support/finance-test-support.js";

const PREFIX = "P05 contract transport ";
const OK_STATUS = 200;
const UNAUTHORIZED_STATUS = 401;
const PRINCIPAL_CENTS = 300_000;
const financeSettings = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  punctualityDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 0,
};

async function cleanup(): Promise<void> {
  const contracts = await db.contract.findMany({
    where: { payer: { name: { startsWith: PREFIX } } },
    select: { id: true },
  });
  const ids = contracts.map((row) => row.id);
  const orders = await db.order.findMany({
    where: { contractId: { in: ids } },
    select: { id: true },
  });
  await db.installment.deleteMany({ where: { orderId: { in: orders.map((row) => row.id) } } });
  await db.order.deleteMany({ where: { contractId: { in: ids } } });
  await db.contract.deleteMany({ where: { id: { in: ids } } });
  await db.payer.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.financeSettings.deleteMany({ where: { id: "singleton" } });
  await db.$disconnect();
}

async function createThroughHttp(): Promise<void> {
  const payer = await db.payer.create({ data: { name: `${PREFIX}payer` } });
  const student = await db.student.create({
    data: { fullName: `${PREFIX}student`, status: "ACTIVE" },
  });
  await db.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...financeSettings },
    update: financeSettings,
  });
  const response = await callHttpMutation({
    path: "finance.createMonthlyContract",
    body: {
      commandId: randomUUID(),
      payerId: payer.id,
      studentId: student.id,
      agreedOn: "2026-03-15",
      startsOn: "2026-03-15",
      durationMonths: 12,
      firstDueDate: "2026-03-31",
      monthlyAmountCents: 25_000,
      punctualityDiscountPct: 20,
    },
  });
  assert.equal(response.status, OK_STATUS);
  const body = (await response.json()) as {
    result: { data: { json: { id: string; principalAmountCents: number } } };
  };
  assert.equal(body.result.data.json.principalAmountCents, PRINCIPAL_CENTS);
  const listResponse = await callHttpQuery({ path: "finance.listContracts", body: { page: 1 } });
  assert.equal(listResponse.status, OK_STATUS);
  const list = (await listResponse.json()) as {
    result: { data: { json: { rows: Array<{ id: string; student: { id: string } }> } } };
  };
  assert.equal(
    list.result.data.json.rows.find((row) => row.id === body.result.data.json.id)?.student.id,
    student.id,
  );
}

async function requiresStaffSession(): Promise<void> {
  const response = await callHttpQuery({
    path: "finance.listContracts",
    body: { page: 1 },
    staffUser: null,
  });
  assert.equal(response.status, UNAUTHORIZED_STATUS);
}

void describe("monthly contract HTTP transport", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(cleanup);
  void it("creates through HTTP and returns the agreement in the list", createThroughHttp);
  void it("requires an authorized staff session", requiresStaffSession);
});
