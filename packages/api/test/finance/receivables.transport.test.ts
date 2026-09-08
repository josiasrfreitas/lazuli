import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  callHttpQuery,
  cleanFinanceOrdersDatabase,
  ensureAdminUser,
  HTTP_OK,
} from "../support/finance-test-support.js";
import {
  createReceivablesFixture,
  RECEIVABLES_TEST_PREFIX,
} from "../support/finance-receivables-test-support.js";

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
  registerReceivablesHttpHooks();
  registerReceivablesSnapshotHttpPath();
  registerOverdueListHttpPath();
});

function registerReceivablesHttpHooks(): void {
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

function registerReceivablesSnapshotHttpPath(): void {
  void it("returns receivables snapshot metrics via HTTP", async () => {
    await createReceivablesFixture();

    const response = await callHttpQuery({ path: "finance.receivablesSnapshot" });
    const payload = (await response.json()) as SnapshotResponseBody;
    assert.equal(response.status, HTTP_OK);
    assert.equal(typeof payload.result.data.json.overdueCents, "number");
  });
}

function registerOverdueListHttpPath(): void {
  void it("returns overdue rows with derived statuses via HTTP", async () => {
    const fixture = await createReceivablesFixture();
    const response = await callHttpQuery({ path: "finance.overdueList" });
    const payload = (await response.json()) as OverdueListResponseBody;
    const overdueRow = payload.result.data.json.rows.find(
      (row) => row.installmentId === fixture.overdueInstallmentId,
    );

    assert.equal(response.status, HTTP_OK);
    assert.equal(overdueRow?.ledger.status, "OVERDUE");
  });
}
