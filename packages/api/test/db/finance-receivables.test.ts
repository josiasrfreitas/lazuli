import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  caller,
  cleanFinanceOrdersDatabase,
  ensureAdminUser,
} from "./finance-test-support.js";
import {
  computeExpectedSnapshotTotals,
  createReceivablesFixture,
  RECEIVABLES_TEST_PREFIX,
} from "./finance-receivables-test-support.js";

void describe("finance receivables dashboard", { concurrency: 1 }, () => {
  registerReceivablesDatabaseHooks();
  registerReceivablesSnapshotHappyPath();
  registerOverdueListHappyPath();
  registerOverdueListExclusions();
});

function registerReceivablesDatabaseHooks(): void {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanFinanceOrdersDatabase(RECEIVABLES_TEST_PREFIX);
    await ensureAdminUser();
  });
  void after(async () => {
    await cleanFinanceOrdersDatabase(RECEIVABLES_TEST_PREFIX);
    await db.$disconnect();
  });
}

function registerReceivablesSnapshotHappyPath(): void {
  databaseIt("returns expected, received, overdue, and age bucket totals per §7.1", async () => {
    const baseline = await caller().finance.receivablesSnapshot();
    const fixture = await createReceivablesFixture();

    const snapshot = await caller().finance.receivablesSnapshot();
    const expected = await computeExpectedSnapshotTotals(fixture);

    assert.equal(
      snapshot.expectedThisMonthCents - baseline.expectedThisMonthCents,
      expected.expectedThisMonthCents,
    );
    assert.equal(
      snapshot.receivedThisMonthCents - baseline.receivedThisMonthCents,
      expected.receivedThisMonthCents,
    );
    assert.equal(snapshot.overdueCents - baseline.overdueCents, expected.overdueCents);
    assert.deepEqual(
      {
        days1To7Cents: snapshot.ageBuckets.days1To7Cents - baseline.ageBuckets.days1To7Cents,
        days8To30Cents: snapshot.ageBuckets.days8To30Cents - baseline.ageBuckets.days8To30Cents,
        days30PlusCents: snapshot.ageBuckets.days30PlusCents - baseline.ageBuckets.days30PlusCents,
      },
      expected.ageBuckets,
    );
  });
}

function registerOverdueListHappyPath(): void {
  databaseIt("returns collectible overdue rows with derived ledger statuses", async () => {
    const fixture = await createReceivablesFixture();

    const result = await caller().finance.overdueList();
    const fixtureRows = result.rows.filter((row) =>
      [fixture.overdueInstallmentId, fixture.inMonthInstallmentId].includes(row.installmentId),
    );

    assert.equal(
      fixtureRows.length,
      fixture.inMonthIsOverdue ? 2 : 1,
    );
    assert.ok(fixtureRows.some((row) => row.installmentId === fixture.overdueInstallmentId));

    if (fixture.inMonthIsOverdue) {
      assert.ok(fixtureRows.some((row) => row.installmentId === fixture.inMonthInstallmentId));
    }

    for (const row of fixtureRows) {
      assert.equal(row.ledger.status, "OVERDUE");
      assert.ok(row.ledger.collectibleRemainingCents > 0);
      assert.equal(row.beneficiaries.length, 1);
      assert.equal(row.beneficiaries[0]?.studentId, fixture.studentId);
      assert.equal(row.beneficiaries[0]?.whatsAppUrl, "https://wa.me/5582999887766");
    }

    assert.ok(result.rows[0]?.dueDate <= (result.rows.at(-1)?.dueDate ?? ""));
  });
}

function registerOverdueListExclusions(): void {
  databaseIt("excludes cancelled orders and waived installments", async () => {
    const fixture = await createReceivablesFixture();

    const result = await caller().finance.overdueList();
    const installmentIds = result.rows.map((row) => row.installmentId);

    assert.ok(!installmentIds.includes(fixture.cancelledOverdueInstallmentId));
    assert.ok(!installmentIds.includes(fixture.waivedOverdueInstallmentId));
    assert.ok(!installmentIds.includes(fixture.futureInstallmentId));
  });
}
