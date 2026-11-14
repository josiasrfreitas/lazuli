import assert from "node:assert/strict";
import { it } from "node:test";
import {
  periodCalendarMonths,
  periodVacations,
  selectedCalendarPeriod,
  vacationAt,
  type CalendarPeriod,
} from "../../src/features/academic-calendar/period-model.js";

function period(id: string, dates: { from: string; through: string }): CalendarPeriod {
  return {
    id,
    name: id,
    startDate: new Date(dates.from),
    endDate: new Date(dates.through),
    updatedAt: new Date("2026-01-01"),
  };
}

void it("includes all thirteen civil months touched by a cross-year leap-year period", () => {
  const selected = period("cross-year", { from: "2027-12-31", through: "2028-12-30" });
  const months = periodCalendarMonths(selected, { fallbackYear: 2027, periods: [selected] });
  assert.equal(months.length, 13);
  assert.deepEqual(months[0], { year: 2027, month: 11, from: "2027-12-01" });
  assert.deepEqual(months.at(-1), { year: 2028, month: 11, from: "2028-12-01" });
});

void it("keeps the vacation gap inclusive and the semester itself outside that gap", () => {
  const first = period("first", { from: "2026-02-02", through: "2026-06-30" });
  const second = period("second", { from: "2026-08-03", through: "2026-12-18" });
  const vacations = periodVacations(second, [first, second]);
  assert.deepEqual(vacations.before, { from: "2026-07-01", through: "2026-08-02" });
  assert.equal(vacationAt("2026-06-30", vacations), null);
  assert.equal(vacationAt("2026-07-01", vacations), "before");
  assert.equal(vacationAt("2026-08-02", vacations), "before");
  assert.equal(vacationAt("2026-08-03", vacations), null);
});

void it("does not expose vacation dates beyond the supported calendar bounds", () => {
  const entireRange = period("bounds", { from: "2000-01-01", through: "2100-12-31" });
  assert.deepEqual(periodVacations(entireRange, [entireRange]), { before: null, after: null });
});

void it("honors an explicit period and otherwise resolves against the requested year", () => {
  const first = period("first", { from: "2026-02-02", through: "2026-06-30" });
  const second = period("second", { from: "2026-08-03", through: "2026-12-18" });
  const periods = [first, second];
  assert.equal(
    selectedCalendarPeriod(periods, { selectedId: "second", year: 2026, today: "2026-03-01" }),
    second,
  );
  assert.equal(
    selectedCalendarPeriod(periods, { selectedId: null, year: 2026, today: "2027-09-01" }),
    first,
  );
  assert.equal(
    selectedCalendarPeriod(periods, { selectedId: null, year: 2026, today: "2026-09-01" }),
    second,
  );
});
