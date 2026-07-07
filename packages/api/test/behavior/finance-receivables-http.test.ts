import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  callHttpQuery,
  cleanFinanceOrdersDatabase,
  ensureAdminUser,
  HTTP_OK,
} from "../db/finance-test-support.js";
import {
  computeExpectedSnapshotTotals,
  createReceivablesFixture,
  RECEIVABLES_TEST_PREFIX,
} from "../db/finance-receivables-test-support.js";

type SnapshotResponseBody = {
  result: {
    data: {
      json: {
        expectedThisMonthCents: number;
        receivedThisMonthCents: number;
        overdueCents: number;
      };
    };
  };
};

type OverdueListResponseBody = {
  result: {
    data: {
      json: {
        rows: Array<{
          installmentId: string;
          ledger: { status: string; collectibleRemainingCents: number };
        }>;
      };
    };
  };
};

void describe("finance receivables API over the tRPC HTTP boundary", { concurrency: 1 }, () => {
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

  databaseIt("returns receivables snapshot metrics via HTTP", async () => {
    const baselineResponse = await callHttpQuery({ path: "finance.receivablesSnapshot" });
    const baselinePayload = (await baselineResponse.json()) as SnapshotResponseBody;
    const fixture = await createReceivablesFixture();

    const response = await callHttpQuery({ path: "finance.receivablesSnapshot" });
    const payload = (await response.json()) as SnapshotResponseBody;
    const expected = await computeExpectedSnapshotTotals(fixture);

    assert.equal(response.status, HTTP_OK);
    assert.equal(
      payload.result.data.json.expectedThisMonthCents -
        baselinePayload.result.data.json.expectedThisMonthCents,
      expected.expectedThisMonthCents,
    );
    assert.equal(
      payload.result.data.json.receivedThisMonthCents -
        baselinePayload.result.data.json.receivedThisMonthCents,
      expected.receivedThisMonthCents,
    );
    assert.equal(
      payload.result.data.json.overdueCents - baselinePayload.result.data.json.overdueCents,
      expected.overdueCents,
    );
  });

  databaseIt("returns overdue rows with derived statuses via HTTP", async () => {
    const fixture = await createReceivablesFixture();

    const response = await callHttpQuery({ path: "finance.overdueList" });
    const payload = (await response.json()) as OverdueListResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.ok(
      payload.result.data.json.rows.some(
        (row) => row.installmentId === fixture.overdueInstallmentId,
      ),
    );

    for (const row of payload.result.data.json.rows.filter((candidate) =>
      [fixture.overdueInstallmentId, fixture.inMonthInstallmentId].includes(candidate.installmentId),
    )) {
      assert.equal(row.ledger.status, "OVERDUE");
      assert.ok(row.ledger.collectibleRemainingCents > 0);
    }
  });
});
