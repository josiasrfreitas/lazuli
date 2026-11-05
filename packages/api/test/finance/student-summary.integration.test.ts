import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { studentFinanceSummary } from "@lazuli/domain";
import { finance } from "../../src/finance/index.js";
import { ADMIN, ensureAdminUser } from "../support/finance-test-support.js";
import {
  createFinancialRulesFixture,
  createInstallmentOrder,
  cleanInstallmentsTestData,
} from "../support/finance-installments-test-support.js";

const NOW = new Date("2026-03-03T02:30:00Z");

void it("aggregates the student's adjusted balances and completing payment dates in parity with the pure rule", async () => {
  await ensureAdminUser();
  try {
    const fixture = await createFinancialRulesFixture();
    const studentId = fixture.studentIds[0];
    assert.ok(studentId);
    await db.paymentAllocation.deleteMany({ where: { installmentId: fixture.paidId } });
    for (const date of ["2026-02-27", "2026-03-02"]) {
      await db.paymentEntry.create({
        data: {
          payerId: fixture.payerId,
          date: new Date(date),
          amountCents: 5000,
          method: "PIX",
          allocations: { create: { installmentId: fixture.paidId, amountCents: 5000 } },
        },
      });
    }
    const upcoming = await createInstallmentOrder({ amountCents: 7000, dueDate: "2026-04-10" });
    await db.orderBeneficiary.updateMany({
      where: { orderId: upcoming.orderId },
      data: { studentId },
    });
    const service = finance(db, ADMIN.id);
    const result = await db.$transaction(
      (transaction) => finance(transaction, ADMIN.id).studentSummary({ studentId, now: NOW }),
      { isolationLevel: "RepeatableRead" },
    );
    assert.equal(result.asOf, "2026-03-02");
    assert.equal(result.installmentCount, 5);
    assert.equal(result.receivedCents, 23_000);
    assert.equal(result.outstandingCents, 13_000);
    assert.equal(result.overdueCents, 6000);
    assert.equal(result.nextDueDate, "2026-04-10");
    assert.equal(result.nextDueCents, 7000);
    assert.equal(result.history.settledCount, 1);
    assert.equal(result.history.lateCount, 1);
    assert.equal(result.history.averageLateDays, 2);
    assert.equal(result.history.paymentState, "OCCASIONAL_DELAY");
    const list = await service.installments({ studentId, view: "all", page: 1, pageSize: 25 }, NOW);
    assert.equal(list.view, "all");
    assert.ok("rows" in list);
    const allocations = await db.paymentAllocation.findMany({
      where: {
        installmentId: { in: list.rows.map((row) => row.installmentId) },
        deletedAt: null,
        paymentEntry: { deletedAt: null },
      },
      select: { installmentId: true, amountCents: true, paymentEntry: { select: { date: true } } },
    });
    const expected = studentFinanceSummary(
      list.rows,
      allocations.map((row) => ({
        installmentId: row.installmentId,
        amountCents: row.amountCents,
        date: row.paymentEntry.date.toISOString().slice(0, 10),
      })),
    );
    const {
      asOf: _asOf,
      contracts,
      materialNeeds,
      latestTermination,
      hasPaymentProofs,
      pendingRenewals,
      ...summary
    } = result;
    assert.deepEqual(contracts, []);
    assert.deepEqual(materialNeeds, []);
    assert.equal(latestTermination, null);
    assert.equal(hasPaymentProofs, false);
    assert.deepEqual(pendingRenewals, []);
    assert.deepEqual(summary, expected);
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});

void it("scopes pages, totals and overdue payer groups by beneficiary rather than shared payer", async () => {
  await ensureAdminUser();
  try {
    const target = await createInstallmentOrder({ installmentCount: 26, dueDate: "2026-02-28" });
    const other = await createInstallmentOrder({ installmentCount: 2, dueDate: "2026-02-28" });
    await db.order.update({ where: { id: other.orderId }, data: { payerId: target.payerId } });
    const studentId = target.studentIds[0];
    assert.ok(studentId);
    const service = finance(db, ADMIN.id);
    const values = { studentId, view: "all" as const, page: 2, pageSize: 25 as const };
    const page = await service.installments(values, NOW);
    assert.equal(page.view, "all");
    assert.ok("rows" in page);
    assert.equal(page.total, 26);
    assert.equal(page.pageCount, 2);
    assert.equal(page.rows.length, 1);
    assert.deepEqual(page.counts, { all: 26, paid: 0, overdue: 26 });
    assert.equal(page.rows[0]?.orderId, target.orderId);
    const overdue = await service.installments({ ...values, view: "overdue", page: 1 }, NOW);
    assert.equal(overdue.view, "overdue");
    assert.ok("groups" in overdue);
    assert.equal(overdue.groups.length, 1);
    assert.equal(overdue.groups[0]?.installmentCount, 26);
    assert.equal(overdue.groups[0]?.collectibleBalanceCents, 260_000);
    await db.orderBeneficiary.updateMany({
      where: { orderId: target.orderId, studentId },
      data: { deletedAt: new Date() },
    });
    const removedLink = await service.installments({ ...values, page: 1 }, NOW);
    assert.equal(removedLink.total, 0);
    const empty = await service.studentSummary({ studentId, now: NOW });
    assert.equal(empty.installmentCount, 0);
    assert.equal(empty.history.paymentState, "INSUFFICIENT_HISTORY");
    assert.equal(empty.nextDueDate, null);
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});

void it("includes contractual ownership without a beneficiary and excludes a removed contract", async () => {
  await ensureAdminUser();
  const fixture = await createInstallmentOrder({ dueDate: "2026-01-30" });
  const studentId = fixture.studentIds[0];
  assert.ok(studentId);
  try {
    const contract = await db.contract.create({ data: { studentId, payerId: fixture.payerId } });
    await db.orderBeneficiary.deleteMany({ where: { orderId: fixture.orderId } });
    await db.order.update({
      where: { id: fixture.orderId },
      data: { contractId: contract.id, payerId: null },
    });
    const service = finance(db, ADMIN.id);
    const summary = await service.studentSummary({ studentId, now: NOW });
    assert.equal(summary.installmentCount, 1);
    assert.equal(summary.overdueCents, 10_000);
    assert.equal(summary.oldestOverdueDays, 31);
    assert.equal(summary.debtState, "SEVERE_OVERDUE");
    assert.deepEqual(await service.studentOverdueTotals({ studentIds: [studentId], now: NOW }), [
      { studentId, hasActiveOrder: true, overdueCents: 10_000 },
    ]);
    const list = await service.installments({ studentId, view: "all", page: 1, pageSize: 25 }, NOW);
    assert.equal(list.total, 1);
    await db.contract.update({ where: { id: contract.id }, data: { deletedAt: new Date() } });
    const removed = await service.studentSummary({ studentId, now: NOW });
    assert.equal(removed.installmentCount, 0);
    assert.equal(removed.receivedCents, 0);
    assert.deepEqual(await service.studentOverdueTotals({ studentIds: [studentId], now: NOW }), [
      { studentId, hasActiveOrder: false, overdueCents: 0 },
    ]);
  } finally {
    await db.order.update({
      where: { id: fixture.orderId },
      data: { contractId: null, payerId: fixture.payerId },
    });
    await db.contract.deleteMany({ where: { studentId } });
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});

void it("chooses the student's initial charge filter server-side without a summary request", async () => {
  await ensureAdminUser();
  try {
    const fixture = await createFinancialRulesFixture();
    const studentId = fixture.studentIds[0]!;
    const service = finance(db, ADMIN.id);
    const values = { studentId, view: "all" as const, page: 1, pageSize: 25 as const };
    const auto = await service.installments({ ...values, studentFilter: "auto" }, NOW);
    assert.equal(auto.view, "all");
    assert.ok("rows" in auto && "studentFilter" in auto);
    assert.equal(auto.studentFilter, "overdue");
    assert.equal(auto.total, 1);
    assert.deepEqual(
      auto.rows.map((row) => row.installmentId),
      [fixture.partialId],
    );
    const manual = await service.installments({ ...values, studentFilter: "all" }, NOW);
    assert.equal(manual.total, 4);
    const dueToday = await service.installments(
      { ...values, studentFilter: "auto" },
      new Date("2026-03-01T02:59:59Z"),
    );
    assert.ok("rows" in dueToday && "studentFilter" in dueToday);
    assert.equal(dueToday.studentFilter, "all");
    assert.equal(dueToday.total, 4);
    const explicit = await service.installments(
      { ...values, studentFilter: "overdue" },
      new Date("2026-03-01T02:59:59Z"),
    );
    assert.ok("rows" in explicit && "studentFilter" in explicit);
    assert.equal(explicit.studentFilter, "overdue");
    assert.equal(explicit.total, 0);
    assert.deepEqual(explicit.rows, []);
  } finally {
    await cleanInstallmentsTestData();
    await db.$disconnect();
  }
});
