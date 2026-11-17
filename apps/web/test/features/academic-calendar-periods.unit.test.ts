import assert from "node:assert/strict";
import { it } from "node:test";
import {
  calendarPeriodsInYear,
  calendarVacationRanges,
  periodCalendarMonths,
  periodVacations,
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

void it("splits a cross-year period into at most twelve months per civil year", () => {
  const selected = period("cross-year", { from: "2027-12-31", through: "2028-12-30" });
  const firstYear = periodCalendarMonths(selected, { fallbackYear: 2027, periods: [selected] });
  const secondYear = periodCalendarMonths(selected, { fallbackYear: 2028, periods: [selected] });
  assert.deepEqual(firstYear, [
    { year: 2027, month: 10, from: "2027-11-01" },
    { year: 2027, month: 11, from: "2027-12-01" },
  ]);
  assert.equal(secondYear.length, 12);
  assert.deepEqual(secondYear[0], { year: 2028, month: 0, from: "2028-01-01" });
  assert.deepEqual(secondYear.at(-1), { year: 2028, month: 11, from: "2028-12-01" });
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

void it("does not infer vacations before the first configured semester", () => {
  const first = period("first", { from: "2026-07-01", through: "2026-11-30" });
  const next = period("next", { from: "2027-02-05", through: "2027-06-01" });
  const vacations = periodVacations(first, [first, next]);
  assert.equal(vacations.before, null);
  assert.equal(vacationAt("2026-01-15", vacations), null);
  assert.deepEqual(vacations.after, { from: "2026-12-01", through: "2027-02-04" });
});

void it("does not infer vacations after the last configured semester", () => {
  const previous = period("previous", { from: "2026-07-01", through: "2026-11-30" });
  const last = period("last", { from: "2027-02-05", through: "2027-06-01" });
  const vacations = periodVacations(last, [previous, last]);
  assert.deepEqual(vacations.before, { from: "2026-12-01", through: "2027-02-04" });
  assert.equal(vacations.after, null);
  assert.equal(vacationAt("2027-12-15", vacations), null);
});

void it("includes one vacation month on either side of the only configured semester", () => {
  const first = period("2027.1", { from: "2027-02-05", through: "2027-06-01" });
  const months = periodCalendarMonths(null, { fallbackYear: 2027, periods: [first] });
  assert.deepEqual(
    months.map((row) => row.month),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(periodCalendarMonths(null, { fallbackYear: 2028, periods: [first] }), []);
});

void it("adds the second semester and its vacation gap without pulling adjacent years into the grid", () => {
  const previous = period("previous", { from: "2026-07-01", through: "2026-11-30" });
  const first = period("2027.1", { from: "2027-02-05", through: "2027-06-01" });
  const second = period("2027.2", { from: "2027-08-02", through: "2027-11-30" });
  const next = period("next", { from: "2028-02-01", through: "2028-06-30" });
  const periods = [next, second, previous, first];
  const months = periodCalendarMonths(null, { fallbackYear: 2027, periods });
  assert.deepEqual(
    months.map((row) => row.month),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(
    calendarPeriodsInYear(periods, 2027).map((row) => row.id),
    ["2027.1", "2027.2"],
  );
  assert.deepEqual(calendarVacationRanges(periods, 2027), [
    { from: "2026-12-01", through: "2027-02-04" },
    { from: "2027-06-02", through: "2027-08-01" },
    { from: "2027-12-01", through: "2028-01-31" },
  ]);
});

void it("keeps an empty year empty and does not invent vacation ranges for it", () => {
  assert.deepEqual(periodCalendarMonths(null, { fallbackYear: 2027 }), []);
  assert.deepEqual(calendarVacationRanges([], 2027), []);
  const only = period("only", { from: "2027-02-01", through: "2027-06-30" });
  assert.deepEqual(calendarVacationRanges([only], 2027), [
    { from: "2027-01-01", through: "2027-01-31" },
    { from: "2027-07-01", through: "2027-07-31" },
  ]);
});
