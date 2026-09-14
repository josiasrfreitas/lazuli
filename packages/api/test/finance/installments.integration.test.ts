import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { deriveInstallmentLedger } from "@lazuli/domain";
import { db } from "@lazuli/db";

import { ensureAdminUser } from "../support/finance-test-support.js";
import {
  allocateInstallment as allocate,
  cleanInstallmentsTestData,
  createFinancialRulesFixture,
  createInstallmentOrder as createOrder,
  createVisibilityFixture,
  INSTALLMENTS_NOW as NOW,
  INSTALLMENTS_PREFIX as PREFIX,
  PARTIAL_FIRST_CENTS,
  PARTIAL_SECOND_CENTS,
  readInstallments as read,
  TEN_THOUSAND_CENTS,
} from "../support/finance-installments-test-support.js";

const PAGE_SIZE = 25;
const RESULT_COUNT = 26;
const LITERAL_BALANCE_CENTS = 6000;

void describe("finance installments query", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
  });

  void beforeEach(async () => {
    await cleanInstallmentsTestData();
    await ensureAdminUser();
  });

  void after(async () => {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  });

  registerPaginationTest();
  registerFinancialRulesTest();
  registerFlatTotalsTest();
  registerOrderingTest();
  registerSearchTest();
  registerCivilDateTest();
  registerVisibilityTest();
});

function registerPaginationTest(): void {
  void it("paginates 26 tied rows without duplicates and preserves totals past the end", async () => {
    const fixture = await createOrder({ installmentCount: RESULT_COUNT, dueDate: "2026-04-10" });

    const first = await read({ page: 1 });
    const second = await read({ page: 2 });
    const beyond = await read({ page: 3 });
    const returnedIds = [...first.rows, ...second.rows].map((row) => row.installmentId);
    const expectedIds = await db.$kysely
      .selectFrom("Installment")
      .select("id")
      .where("order_id", "=", fixture.orderId)
      .orderBy("id", "asc")
      .execute();

    assert.equal(first.rows.length, PAGE_SIZE);
    assert.equal(second.rows.length, 1);
    assert.deepEqual(
      returnedIds,
      expectedIds.map((row) => row.id),
    );
    assert.equal(new Set(returnedIds).size, RESULT_COUNT);
    assert.deepEqual(
      {
        total: beyond.total,
        pageCount: beyond.pageCount,
        rows: beyond.rows,
        counts: beyond.counts,
      },
      {
        total: RESULT_COUNT,
        pageCount: 2,
        rows: [],
        counts: { all: RESULT_COUNT, paid: 0, overdue: 0 },
      },
    );
  });
}

function registerFinancialRulesTest(): void {
  void it("matches domain finance rules without multiplying adjustments, payments, or beneficiaries", async () => {
    const fixture = await createFinancialRulesFixture();
    const result = await read({ page: 1 });
    const partial = result.rows.find((row) => row.installmentId === fixture.partialId);
    const oracle = deriveInstallmentLedger({
      amountCents: TEN_THOUSAND_CENTS,
      dueDate: "2026-02-28",
      waivedAt: null,
      orderCancelledAt: null,
      adjustments: [{ amountCents: -400 }, { amountCents: -600 }],
      allocations: [{ amountCents: PARTIAL_FIRST_CENTS }, { amountCents: PARTIAL_SECOND_CENTS }],
      now: NOW,
      interestRatePctMonthly: 1,
    });

    assert.deepEqual(
      partial && {
        expected: partial.expectedAmountCents,
        paid: partial.paidAmountCents,
        balance: partial.collectibleBalanceCents,
        status: partial.status,
        overdueDays: partial.overdueDays,
      },
      {
        expected: oracle.currentExpectedCents,
        paid: oracle.paidAmountCents,
        balance: oracle.collectibleRemainingCents,
        status: oracle.status,
        overdueDays: oracle.overdueDays,
      },
    );
    assert.equal(partial?.collectibleBalanceCents, LITERAL_BALANCE_CENTS);
    assert.equal(partial?.beneficiaries.length, 2);
    assert.deepEqual(result.counts, { all: 4, paid: 2, overdue: 1 });

    const paidView = await read({ view: "paid", page: 1 });
    assert.deepEqual(
      new Set(paidView.rows.map((row) => row.installmentId)),
      new Set([fixture.paidId, fixture.zeroExpectedId]),
    );
    const waived = result.rows.find((row) => row.installmentId === fixture.waivedId);
    assert.deepEqual(
      { status: waived?.status, balance: waived?.collectibleBalanceCents },
      { status: "WAIVED", balance: 0 },
    );
  });
}

function registerOrderingTest(): void {
  void it("orders overdue, open, and closed ranges by their contractual due-date directions", async () => {
    const overdueEarlier = await createOrder({ dueDate: "2026-01-10" });
    const overdueLater = await createOrder({ dueDate: "2026-02-10" });
    const openEarlier = await createOrder({ dueDate: "2026-03-10" });
    const openLater = await createOrder({ dueDate: "2026-04-10" });
    const paidLater = await createOrder({ dueDate: "2025-12-10" });
    const waivedEarlier = await createOrder({ dueDate: "2025-11-10" });
    const paidId = paidLater.installmentIds[0];
    const waivedId = waivedEarlier.installmentIds[0];
    assert.ok(paidId && waivedId);
    await allocate({
      payerId: paidLater.payerId,
      installmentId: paidId,
      amounts: [TEN_THOUSAND_CENTS],
    });
    await db.installment.update({
      where: { id: waivedId },
      data: { waivedAt: NOW, waivedReason: "isenção" },
    });

    const result = await read({});

    assert.deepEqual(
      result.rows.map((row) => row.installmentId),
      [
        overdueEarlier.installmentIds[0],
        overdueLater.installmentIds[0],
        openEarlier.installmentIds[0],
        openLater.installmentIds[0],
        paidId,
        waivedId,
      ],
    );
  });
}

function registerSearchTest(): void {
  void it("searches literal wildcards and visible beneficiary names while returning all visible beneficiaries", async () => {
    const matching = await createOrder({
      payerName: "Pagador 100%_Real",
      beneficiaryNames: ["Aluna Agulha", "Colega Completa", "Nome Oculto"],
    });
    await createOrder({ payerName: "Pagador 100ABCXReal", beneficiaryNames: ["Outra Pessoa"] });
    const hiddenStudentId = matching.studentIds[2];
    assert.ok(hiddenStudentId);
    await db.orderBeneficiary.update({
      where: { orderId_studentId: { orderId: matching.orderId, studentId: hiddenStudentId } },
      data: { deletedAt: NOW },
    });

    const byWildcard = await read({ search: "%_" });
    const byBeneficiary = await read({ search: "aGuLhA" });
    const byHiddenBeneficiary = await read({ search: "Nome Oculto" });

    assert.deepEqual(
      byWildcard.rows.map((row) => row.orderId),
      [matching.orderId],
    );
    assert.deepEqual(
      byBeneficiary.rows[0]?.beneficiaries.map((beneficiary) => beneficiary.fullName),
      [`${PREFIX}Aluna Agulha`, `${PREFIX}Colega Completa`],
    );
    assert.equal(byHiddenBeneficiary.total, 0);
  });
}

function registerCivilDateTest(): void {
  void it("uses the Sao Paulo civil date across a UTC month boundary", async () => {
    const fixture = await createOrder({ installmentCount: 2, dueDate: "2026-03-31" });
    const yesterdayId = fixture.installmentIds[1];
    assert.ok(yesterdayId);
    await db.installment.update({
      where: { id: yesterdayId },
      data: { dueDate: new Date("2026-03-30T00:00:00.000Z") },
    });

    const result = await read({ now: new Date("2026-04-01T02:30:00.000Z") });
    const today = result.rows.find((row) => row.installmentId === fixture.installmentIds[0]);
    const yesterday = result.rows.find((row) => row.installmentId === yesterdayId);

    assert.deepEqual(
      { status: today?.status, overdueDays: today?.overdueDays },
      { status: "DUE_THIS_MONTH", overdueDays: 0 },
    );
    assert.deepEqual(
      { status: yesterday?.status, overdueDays: yesterday?.overdueDays },
      { status: "OVERDUE", overdueDays: 1 },
    );
  });
}

function registerVisibilityTest(): void {
  void it("excludes deleted installments, orders, payers, adjustments, allocations, payments, links, and students", async () => {
    const fixture = await createVisibilityFixture();
    const result = await read({});
    const activeRow = result.rows.find((row) => row.orderId === fixture.activeOrderId);
    const returnedOrderIds = new Set(result.rows.map((row) => row.orderId));

    assert.deepEqual(
      fixture.excludedOrderIds.filter((orderId) => returnedOrderIds.has(orderId)),
      [],
    );
    assert.deepEqual(
      { expected: activeRow?.expectedAmountCents, paid: activeRow?.paidAmountCents },
      { expected: TEN_THOUSAND_CENTS, paid: 0 },
    );
    assert.deepEqual(
      activeRow?.beneficiaries.map((row) => row.fullName),
      [`${PREFIX}Ativa`],
    );
  });
}

function registerFlatTotalsTest(): void {
  void it("preserves flat discriminants and totals for all and paid", async () => {
    await createFinancialRulesFixture();
    const all = await read({});
    const paid = await read({ view: "paid" });
    assert.deepEqual(
      { view: all.view, total: all.total, pages: all.pageCount },
      { view: "all", total: 4, pages: 1 },
    );
    assert.deepEqual(
      { view: paid.view, total: paid.total, pages: paid.pageCount },
      { view: "paid", total: 2, pages: 1 },
    );
  });
}
