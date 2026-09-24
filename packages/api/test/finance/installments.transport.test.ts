import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";
import type { StaffUser } from "@lazuli/api";
import type { FinanceInstallmentRow, FinanceInstallmentsOutput } from "@lazuli/validators";

import {
  callHttpQuery,
  cleanFinanceOrdersDatabase,
  ensureAdminUser,
  HTTP_OK,
} from "../support/finance-test-support.js";

const PROCEDURE = "finance.installments";
const GROUP_PAGE_SIZE = 10;
const PREFIX = "Installments transport ";
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const NOW = new Date("2020-04-11T03:00:00.000Z");

void describe("finance.installments HTTP contract", { concurrency: 1 }, () => {
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

  registerSerializationTest();
  registerAuthorizationTest();
  registerOverdueSerializationTest();
});

function registerSerializationTest(): void {
  void it("serializes the discriminated installment response for an admin", async () => {
    const fixture = await createTransportInstallment();
    const response = await callHttpQuery({
      path: PROCEDURE,
      body: { view: "all", page: 1, search: PREFIX },
      now: NOW,
    });
    const payload = (await response.json()) as {
      result: { data: { json: { view: string; rows: FinanceInstallmentRow[] } } };
    };
    const row = payload.result.data.json.rows.find(
      (candidate) => candidate.installmentId === fixture.installmentId,
    );

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.view, "all");
    assert.deepEqual(row, {
      installmentId: fixture.installmentId,
      orderId: fixture.orderId,
      origin: "TUITION",
      sequenceNumber: 1,
      scheduleTotal: 1,
      payer: { id: fixture.payerId, name: `${PREFIX}Pagador` },
      beneficiaries: [{ studentId: fixture.studentId, fullName: `${PREFIX}Aluna` }],
      dueDate: "2020-04-10",
      originalAmountCents: 10_000,
      expectedAmountCents: 10_000,
      paidAmountCents: 0,
      collectibleBalanceCents: 10_000,
      status: "OVERDUE",
      overdueDays: 1,
    });
  });
}

function registerAuthorizationTest(): void {
  void it("rejects anonymous and every non-admin staff role", async () => {
    const identities: Array<StaffUser | null> = [
      null,
      staff("TEACHER"),
      staff("SECRETARY"),
      staff("FINANCE"),
    ];

    const responses = await Promise.all(
      identities.map((staffUser) =>
        callHttpQuery({ path: PROCEDURE, body: { view: "overdue" }, staffUser }),
      ),
    );

    assert.deepEqual(
      responses.map((response) => response.status),
      [HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_FORBIDDEN, HTTP_FORBIDDEN],
    );
  });
}

function staff(role: StaffUser["role"]): StaffUser {
  return {
    id: crypto.randomUUID(),
    name: `${role} teste`,
    email: `${role.toLowerCase()}@example.com`,
    role,
    isEnabled: true,
  };
}

async function createTransportInstallment(): Promise<{
  payerId: string;
  studentId: string;
  orderId: string;
  installmentId: string;
}> {
  const payer = await db.payer.create({ data: { name: `${PREFIX}Pagador` } });
  const student = await db.student.create({
    data: { fullName: `${PREFIX}Aluna`, status: "ACTIVE" },
  });
  const order = await db.order.create({
    data: {
      payerId: payer.id,
      kind: "TUITION",
      principalAmountCents: 10_000,
      startDate: new Date("2020-04-01T00:00:00.000Z"),
      dueDay: 10,
      beneficiaries: { create: { studentId: student.id } },
      installments: {
        create: {
          sequenceNumber: 1,
          amountCents: 10_000,
          dueDate: new Date("2020-04-10T00:00:00.000Z"),
        },
      },
    },
    select: { id: true, installments: { select: { id: true } } },
  });
  return {
    payerId: payer.id,
    studentId: student.id,
    orderId: order.id,
    installmentId: order.installments[0]?.id ?? "",
  };
}

function registerOverdueSerializationTest(): void {
  void it("serializes complete overdue groups through the admin HTTP adapter", async () => {
    const fixture = await createTransportInstallment();
    const response = await callHttpQuery({
      path: PROCEDURE,
      body: { view: "overdue", search: PREFIX },
      now: NOW,
    });
    const payload = (await response.json()) as {
      result: {
        data: {
          json: Extract<FinanceInstallmentsOutput, { view: "overdue" }>;
        };
      };
    };
    const result = payload.result.data.json;
    assert.equal(response.status, HTTP_OK);
    assert.equal(result.view, "overdue");
    assert.equal(result.pageSize, GROUP_PAGE_SIZE);
    assert.equal(result.total, 1);
    assert.equal(result.pageCount, 1);
    assert.deepEqual(
      result.groups.map((group) => ({
        payer: group.payer,
        count: group.installmentCount,
        balance: group.collectibleBalanceCents,
        days: group.maxOverdueDays,
        beneficiaries: group.beneficiaries,
        rows: group.rows.map((row) => ({
          id: row.installmentId,
          date: row.dueDate,
          status: row.status,
          balance: row.collectibleBalanceCents,
        })),
      })),
      [
        {
          payer: { id: fixture.payerId, name: `${PREFIX}Pagador` },
          count: 1,
          balance: 10_000,
          days: 1,
          beneficiaries: [{ studentId: fixture.studentId, fullName: `${PREFIX}Aluna` }],
          rows: [
            { id: fixture.installmentId, date: "2020-04-10", status: "OVERDUE", balance: 10_000 },
          ],
        },
      ],
    );
  });
}
