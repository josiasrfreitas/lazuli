import assert from "node:assert/strict";
import { it } from "node:test";
import { finance } from "../../src/finance/index.js";

type Database = Parameters<typeof finance>[0];
const now = new Date("2026-11-01T00:30:00Z"); // Still October 31 in São Paulo.
void it("does not load financial facts for an empty student page", async () => {
  const database = {
    order: {
      findMany: () => {
        throw new Error("No order query expected");
      },
    },
  } as object as Database;
  assert.deepEqual(
    await finance(database, "balances-test-admin").studentOverdueTotals({ now, studentIds: [] }),
    [],
  );
});
