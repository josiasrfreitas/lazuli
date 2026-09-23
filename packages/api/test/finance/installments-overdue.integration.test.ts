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
  readInstallments as read,
} from "../support/finance-installments-test-support.js";

const GROUP_PAGE_SIZE = 10;
const GROUP_INSTALLMENT_COUNT = 3;
const GROUP_BALANCE_CENTS = 30_000;
const INSTALLMENT_CENTS = 10_000;
const AFTER_MONTH_BOUNDARY = new Date("2026-04-01T03:00:00Z");
const RECENT_DUE_DATE = "2026-02-28";
const LOWER_AMOUNT_CENTS = 5000;

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
  registerSearchTest();
  registerFinanceTest();
  registerLargeBalanceTest();
  registerGroupIdentityTest();
  registerVisibilityTest();
  registerDatesTest();
  registerFilteredGroupsTest();
});
function registerFilteredGroupsTest(): void {
  void it("recomputes an overdue payer group from installments inside the period and amount range", async () => {
    const fixture = await createOrder({ installmentCount: 3, dueDate: RECENT_DUE_DATE });
    await db.installment.update({
      where: { id: fixture.installmentIds[0]! },
      data: { amountCents: LOWER_AMOUNT_CENTS },
    });
    await db.installment.update({
      where: { id: fixture.installmentIds[1]! },
      data: { dueDate: new Date("2026-01-01T00:00:00.000Z") },
    });

    const result = await read({
      view: "overdue",
      dueFrom: RECENT_DUE_DATE,
      dueTo: RECENT_DUE_DATE,
      amountFromCents: INSTALLMENT_CENTS,
      amountToCents: INSTALLMENT_CENTS,
    });

    assert.deepEqual(
      result.groups[0]?.rows.map((row) => row.installmentId),
      [fixture.installmentIds[2]],
    );
    assert.equal(result.groups[0]?.installmentCount, 1);
    assert.equal(result.groups[0]?.collectibleBalanceCents, INSTALLMENT_CENTS);
    assert.deepEqual(result.counts, { all: 1, paid: 0, overdue: 1 });
  });
}
function registerPaginationTest(): void {
  void it("pages complete payer groups by urgency and ID, keeping homonyms separate", async () => {
    const large = await createOrder({
      installmentCount: 26,
      dueDate: "2026-01-01",
      payerName: "Homônimo",
    });
    const tied = [];
    for (let index = 0; index < GROUP_PAGE_SIZE; index++) {
      tied.push(await createOrder({ dueDate: RECENT_DUE_DATE, payerName: "Homônimo" }));
    }
    const first = await read({ view: "overdue" });
    const second = await read({ view: "overdue", page: 2 });
    const beyond = await read({ view: "overdue", page: 3 });
    const tiedPayerIds = tied.map((item) => item.payerId);
    const expectedPayers = [large.payerId, ...(await orderedIds("Payer", tiedPayerIds))];
    assert.deepEqual(
      [...first.groups, ...second.groups].map((group) => group.payer.id),
      expectedPayers,
    );
    assert.equal(first.groups.length, GROUP_PAGE_SIZE);
    assert.equal(second.groups.length, 1);
    assert.deepEqual(
      first.groups[0]?.rows.map((row) => row.installmentId),
      await orderedIds("Installment", large.installmentIds),
    );
    assert.deepEqual(
      first.groups[0] && {
        count: first.groups[0].installmentCount,
        balance: first.groups[0].collectibleBalanceCents,
        days: first.groups[0].maxOverdueDays,
      },
      { count: 26, balance: 260_000, days: 59 },
    );
    assert.deepEqual(
      {
        groups: beyond.groups,
        total: beyond.total,
        pages: beyond.pageCount,
        size: beyond.pageSize,
        counts: beyond.counts,
      },
      { groups: [], total: 11, pages: 2, size: 10, counts: { all: 36, paid: 0, overdue: 36 } },
    );
  });
}

function registerSearchTest(): void {
  void it("expands beneficiary matches to the entire debt across orders, with view-specific counts", async () => {
    const { ana, bruno } = await createSearchFixture();
    const overdue = await read({ view: "overdue", search: "aGuLhA" });
    const all = await read({ search: "aGuLhA" });
    const paidTab = await read({ view: "paid", search: "aGuLhA" });
    assert.deepEqual(overdue.counts, { all: 3, paid: 0, overdue: 3 });
    assert.deepEqual(all.counts, overdue.counts);
    assert.deepEqual(paidTab.counts, overdue.counts);
    assert.deepEqual(
      overdue.groups[0]?.beneficiaries.map((student) => student.fullName),
      [`${PREFIX}Ana Agulha`, `${PREFIX}Bruno`],
    );
    assert.deepEqual(
      overdue.groups[0]?.rows.map((row) => row.installmentId),
      [...(await orderedIds("Installment", bruno.installmentIds)), ...ana.installmentIds],
    );
    assert.equal(overdue.groups[0]?.collectibleBalanceCents, GROUP_BALANCE_CENTS);
    for (const search of ["Só Futura", "Só Quitada"]) {
      const empty = await read({ view: "overdue", search });
      assert.deepEqual(
        {
          groups: empty.groups,
          total: empty.total,
          pages: empty.pageCount,
          overdue: empty.counts.overdue,
        },
        { groups: [], total: 0, pages: 0, overdue: 0 },
      );
    }
    await db.orderBeneficiary.delete({
      where: { orderId_studentId: { orderId: bruno.orderId, studentId: ana.studentIds[0] ?? "" } },
    });
    const expanded = await read({ view: "overdue", search: "Agulha" });
    assert.deepEqual(expanded.counts, { all: 1, paid: 0, overdue: 3 });
    assert.equal(expanded.groups[0]?.installmentCount, GROUP_INSTALLMENT_COUNT);
  });
}

function registerFinanceTest(): void {
  void it("keeps only collectible financial rows and their independently calculated group balance", async () => {
    const fixture = await createFinancialRulesFixture();
    const result = await read({ view: "overdue" });
    assert.deepEqual(
      result.groups.map((group) => ({
        payer: group.payer.id,
        count: group.installmentCount,
        balance: group.collectibleBalanceCents,
        days: group.maxOverdueDays,
        ids: group.rows.map((row) => row.installmentId),
      })),
      [{ payer: fixture.payerId, count: 1, balance: 6000, days: 1, ids: [fixture.partialId] }],
    );
    const row = result.groups[0]?.rows[0];
    const oracle = deriveInstallmentLedger({
      amountCents: 10_000,
      dueDate: RECENT_DUE_DATE,
      waivedAt: null,
      orderCancelledAt: null,
      adjustments: [{ amountCents: -400 }, { amountCents: -600 }],
      allocations: [{ amountCents: 1000 }, { amountCents: 2000 }],
      now: NOW,
      interestRatePctMonthly: 1,
    });
    assert.deepEqual(
      {
        expected: row?.expectedAmountCents,
        paid: row?.paidAmountCents,
        balance: row?.collectibleBalanceCents,
        status: row?.status,
        days: row?.overdueDays,
      },
      {
        expected: oracle.currentExpectedCents,
        paid: oracle.paidAmountCents,
        balance: oracle.collectibleRemainingCents,
        status: oracle.status,
        days: oracle.overdueDays,
      },
    );
  });
}

function registerVisibilityTest(): void {
  void it("respects soft deletes without removing debt when beneficiaries disappear", async () => {
    const fixture = await createVisibilityFixture();
    const later = new Date("2026-04-11T03:00:00Z");
    const result = await read({ view: "overdue", now: later });
    assert.deepEqual(
      result.groups.flatMap((group) => group.rows.map((row) => row.orderId)),
      [fixture.activeOrderId],
    );
    assert.equal(result.groups[0]?.collectibleBalanceCents, INSTALLMENT_CENTS);
    assert.deepEqual(
      result.groups[0]?.beneficiaries.map((student) => student.fullName),
      [`${PREFIX}Ativa`],
    );
    for (const search of ["Vínculo excluído", "Aluna excluída"]) {
      const hidden = await read({ view: "overdue", search, now: later });
      assert.equal(hidden.total, 0);
    }
    await db.orderBeneficiary.updateMany({
      where: { orderId: fixture.activeOrderId },
      data: { deletedAt: NOW },
    });
    const withoutStudents = await read({ view: "overdue", now: later });
    assert.equal(withoutStudents.groups[0]?.collectibleBalanceCents, INSTALLMENT_CENTS);
    assert.deepEqual(withoutStudents.groups[0]?.beneficiaries, []);
    assert.deepEqual(withoutStudents.groups[0]?.rows[0]?.beneficiaries, []);
  });
}

function registerDatesTest(): void {
  void it("qualifies literal payer searches and crosses Sao Paulo midnight at month end", async () => {
    const fixture = await createOrder({ dueDate: "2026-03-31", payerName: String.raw`100%_\Real` });
    await createOrder({ dueDate: "2026-03-31", payerName: "100ABCXReal" });
    const before = await read({
      view: "overdue",
      search: "%_\\",
      now: new Date("2026-04-01T02:59:59Z"),
    });
    const after = await read({
      view: "overdue",
      search: "%_\\",
      now: AFTER_MONTH_BOUNDARY,
    });
    for (const search of ["%", "_"]) {
      const literal = await read({
        view: "overdue",
        search,
        now: AFTER_MONTH_BOUNDARY,
      });
      assert.deepEqual(
        literal.groups.map((group) => group.payer.id),
        [fixture.payerId],
      );
    }
    const unfiltered = await read({
      view: "overdue",
      search: "",
      now: AFTER_MONTH_BOUNDARY,
    });
    assert.ok(unfiltered.counts.overdue >= 2);
    assert.deepEqual(
      { groups: before.groups, total: before.total, pages: before.pageCount },
      { groups: [], total: 0, pages: 0 },
    );
    assert.deepEqual(
      after.groups.map((group) => ({ id: group.payer.id, days: group.maxOverdueDays })),
      [{ id: fixture.payerId, days: 1 }],
    );
  });
}

async function createSearchFixture(): Promise<{
  ana: Awaited<ReturnType<typeof createOrder>>;
  bruno: Awaited<ReturnType<typeof createOrder>>;
}> {
  const ana = await createOrder({ dueDate: RECENT_DUE_DATE, beneficiaryNames: ["Ana Agulha"] });
  const bruno = await createOrder({
    installmentCount: 2,
    dueDate: "2026-02-01",
    beneficiaryNames: ["Bruno"],
  });
  await db.order.update({ where: { id: bruno.orderId }, data: { payerId: ana.payerId } });
  await db.orderBeneficiary.create({
    data: { orderId: bruno.orderId, studentId: ana.studentIds[0] ?? "" },
  });
  const future = await createOrder({ beneficiaryNames: ["Só Futura"] });
  await db.order.update({ where: { id: future.orderId }, data: { payerId: ana.payerId } });
  const paid = await createOrder({ dueDate: "2026-02-01", beneficiaryNames: ["Só Quitada"] });
  await db.order.update({ where: { id: paid.orderId }, data: { payerId: ana.payerId } });
  await allocate({
    payerId: ana.payerId,
    installmentId: paid.installmentIds[0] ?? "",
    amounts: [INSTALLMENT_CENTS],
  });
  return { ana, bruno };
}

async function orderedIds(table: "Payer" | "Installment", ids: string[]): Promise<string[]> {
  const rows = await db.$kysely
    .selectFrom(table)
    .select("id")
    .where("id", "in", ids)
    .orderBy("id", "asc")
    .execute();
  return rows.map((row) => row.id);
}

function registerLargeBalanceTest(): void {
  void it("sums separate valid orders even when the payer balance exceeds a PostgreSQL integer", async () => {
    const first = await createOrder({ amountCents: 1_500_000_000, dueDate: RECENT_DUE_DATE });
    const second = await createOrder({ amountCents: 1_500_000_000, dueDate: RECENT_DUE_DATE });
    await db.order.update({ where: { id: second.orderId }, data: { payerId: first.payerId } });
    const result = await read({ view: "overdue" });
    assert.deepEqual(
      result.groups.map((group) => ({
        count: group.installmentCount,
        balance: group.collectibleBalanceCents,
      })),
      [{ count: 2, balance: 3_000_000_000 }],
    );
  });
}

function registerGroupIdentityTest(): void {
  void it("keeps each payer's beneficiaries separate and serializes both group and row identities", async () => {
    const first = await createOrder({
      dueDate: "2026-01-01",
      payerName: "Primeiro",
      beneficiaryNames: ["Ana"],
    });
    const second = await createOrder({
      dueDate: RECENT_DUE_DATE,
      payerName: "Segundo",
      beneficiaryNames: ["Bia"],
    });
    const result = await read({ view: "overdue" });
    assert.equal(result.view, "overdue");
    assert.deepEqual(
      result.groups.map((group) => ({
        payer: group.payer,
        students: group.beneficiaries.map((student) => student.studentId),
        rowPayers: group.rows.map((row) => row.payer),
      })),
      [
        {
          payer: { id: first.payerId, name: `${PREFIX}Primeiro` },
          students: first.studentIds,
          rowPayers: [{ id: first.payerId, name: `${PREFIX}Primeiro` }],
        },
        {
          payer: { id: second.payerId, name: `${PREFIX}Segundo` },
          students: second.studentIds,
          rowPayers: [{ id: second.payerId, name: `${PREFIX}Segundo` }],
        },
      ],
    );
  });
}
