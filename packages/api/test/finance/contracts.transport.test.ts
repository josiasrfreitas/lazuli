import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  callHttpMutation,
  callHttpQuery,
  ensureAdminUser,
} from "../support/finance-test-support.js";

const prefix = "P05 contract transport ";

void describe("monthly contract HTTP transport", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await ensureAdminUser();
  });
  void after(async () => {
    const contracts = await db.contract.findMany({
      where: { payer: { name: { startsWith: prefix } } },
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
    await db.payer.deleteMany({ where: { name: { startsWith: prefix } } });
    await db.student.deleteMany({ where: { fullName: { startsWith: prefix } } });
    await db.financeSettings.deleteMany({ where: { id: "singleton" } });
    await db.$disconnect();
  });

  void it("creates through HTTP and returns the same agreement in the list", async () => {
    const payer = await db.payer.create({ data: { name: `${prefix}payer` } });
    const student = await db.student.create({
      data: { fullName: `${prefix}student`, status: "ACTIVE" },
    });
    await db.financeSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        tuitionCeilingCents: 25_000,
        maximumDiscountPct: 20,
        interestRatePctDaily: 0.1,
        interestRatePctMonthly: 2,
        cancellationFeePct: 10,
        materialPriceCents: 0,
      },
      update: {
        tuitionCeilingCents: 25_000,
        maximumDiscountPct: 20,
        interestRatePctDaily: 0.1,
        interestRatePctMonthly: 2,
        cancellationFeePct: 10,
        materialPriceCents: 0,
      },
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
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      result: { data: { json: { id: string; principalAmountCents: number } } };
    };
    assert.equal(body.result.data.json.principalAmountCents, 300_000);
    const listResponse = await callHttpQuery({ path: "finance.listContracts", body: { page: 1 } });
    assert.equal(listResponse.status, 200);
    const list = (await listResponse.json()) as {
      result: { data: { json: { rows: Array<{ id: string; student: { id: string } }> } } };
    };
    assert.equal(
      list.result.data.json.rows.find((row) => row.id === body.result.data.json.id)?.student.id,
      student.id,
    );
  });

  void it("requires an authorized staff session", async () => {
    const response = await callHttpQuery({
      path: "finance.listContracts",
      body: { page: 1 },
      staffUser: null,
    });
    assert.equal(response.status, 401);
  });
});
