import assert from "node:assert/strict";
import { it } from "node:test";
import { enrollmentEntryIso, endOfDayUtc } from "../src/seed-dev-support.js";
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

void it("caps late fixture entries at today at the beginning of the semester", () => {
  assert.equal(
    enrollmentEntryIso({
      semesterStartIso: "2026-07-01",
      todayIso: "2026-07-10",
      entryOffsetDays: 35,
    }),
    "2026-07-10",
  );
  assert.equal(
    enrollmentEntryIso({
      semesterStartIso: "2026-07-01",
      todayIso: "2026-10-10",
      entryOffsetDays: 35,
    }),
    "2026-08-05",
  );
});

void it("records attendance after the evening session finishes in São Paulo", () => {
  assert.equal(endOfDayUtc("2026-12-31").toISOString(), "2027-01-01T02:59:00.000Z");
});
