import assert from "node:assert/strict";
import { it } from "node:test";
import { homePeriod, monthlyCounts } from "../../src/dashboard/home-insights.js";

void it("compares the same elapsed civil days and clamps a shorter prior month", () => {
  const period = homePeriod(new Date("2026-03-31T18:00:00Z"));
  assert.equal(period.through, "2026-03-31");
  assert.equal(period.previousThrough, "2026-02-28");
  assert.equal(period.partial, true);
});
void it("uses the school's date across midnight and carries a six-month series across years", () => {
  const period = homePeriod(new Date("2026-01-01T02:30:00Z"));
  assert.equal(period.month, "2025-12");
  assert.equal(period.through, "2025-12-31");
  assert.equal(period.previousThrough, "2025-11-30");
  const january = homePeriod(new Date("2026-01-12T15:00:00Z"));
  assert.deepEqual(january.months, [
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
  assert.equal(january.previousThrough, "2025-12-12");
});
void it("compares completed months in full, including leap February", () => {
  const period = homePeriod(new Date("2024-05-10T15:00:00Z"), "2024-03");
  assert.equal(period.through, "2024-03-31");
  assert.equal(period.previousThrough, "2024-02-29");
  assert.equal(period.partial, false);
});
void it("does not include later prior-month days in the comparison or future days in the current value", () => {
  const period = homePeriod(new Date("2026-10-10T15:00:00Z"));
  const result = monthlyCounts(
    ["2026-09-01", "2026-09-10", "2026-09-11", "2026-10-01", "2026-10-11"],
    period,
  );
  assert.equal(result.value, 1);
  assert.equal(result.previous, 2);
  assert.deepEqual(result.series.slice(-2), [
    { month: "2026-09", value: 3 },
    { month: "2026-10", value: 1 },
  ]);
});
