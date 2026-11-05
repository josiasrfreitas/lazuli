import assert from "node:assert/strict";
import { it } from "node:test";
import { studentOverdueTotals } from "../../src/finance/internal/student-balances.js";

type Database = Parameters<typeof studentOverdueTotals>[0]["database"];
const now = new Date("2026-11-01T00:30:00Z"); // Still October 31 in São Paulo.
void it("does not load financial facts for an empty student page", async () => {
  const database = {
    order: {
      findMany: () => {
        throw new Error("No order query expected");
      },
    },
  } as object as Database;
  assert.deepEqual(await studentOverdueTotals({ database, values: { now, studentIds: [] } }), []);
});
