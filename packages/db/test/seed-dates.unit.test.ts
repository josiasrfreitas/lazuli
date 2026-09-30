import assert from "node:assert/strict";
import { it } from "node:test";
import { monthlyDueDate } from "../src/seed-dev-finance.js";

for (const [today, monthOffset, expected] of [
  ["2026-01-15", 1, "2026-02-28"],
  ["2028-01-15", 1, "2028-02-29"],
  ["2026-12-15", 1, "2027-01-31"],
  ["2026-01-15", -1, "2025-12-31"],
] as const) {
  void it(`keeps day-31 fixture due dates in their intended month (${expected})`, () => {
    assert.equal(
      monthlyDueDate(today, { monthOffset, dueDay: 31 }).toISOString(),
      `${expected}T00:00:00.000Z`,
    );
  });
}
