import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adjacentMonth,
  monthWeeks,
} from "../../src/features/class-records/calendar-month-weeks-model.js";

void test("month selector includes partial weeks and keeps their selection inside the displayed month", () => {
  assert.deepEqual(monthWeeks("2026-10-16"), [
    { from: "2026-09-28", through: "2026-10-04", selectDate: "2026-10-01" },
    { from: "2026-10-05", through: "2026-10-11", selectDate: "2026-10-05" },
    { from: "2026-10-12", through: "2026-10-18", selectDate: "2026-10-12" },
    { from: "2026-10-19", through: "2026-10-25", selectDate: "2026-10-19" },
    { from: "2026-10-26", through: "2026-11-01", selectDate: "2026-10-26" },
  ]);
});

void test("six-week months and year boundaries remain navigable", () => {
  const weeks = monthWeeks("2026-08-31");
  assert.equal(weeks.length, 6);
  assert.deepEqual(weeks[5], {
    from: "2026-08-31",
    through: "2026-09-06",
    selectDate: "2026-08-31",
  });
  assert.equal(adjacentMonth("2026-12-31", 1), "2027-01-01");
  assert.equal(adjacentMonth("2026-01-01", -1), "2025-12-01");
});
