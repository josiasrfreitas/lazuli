import { civilDate, isoDay, shiftDay } from "./date-model";
import type { AcademicYear } from "./model";

const MONTHS_PER_YEAR = 12;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const MONTH_END = 7;
type CalendarMonth = { year: number; month: number; from: string };

export type CalendarPeriod = AcademicYear["periods"][number];
export type CalendarVacations = {
  before: { from: string | null; through: string } | null;
  after: { from: string; through: string | null } | null;
};

export function periodVacations(
  period: CalendarPeriod | null,
  periods: CalendarPeriod[],
): CalendarVacations {
  if (!period) return { before: null, after: null };
  const index = periods.findIndex((row) => row.id === period.id);
  const previous = periods[index - 1];
  const next = index === -1 ? undefined : periods[index + 1];
  const before = {
    from: previous ? shiftDay(civilDate(previous.endDate), 1) : null,
    through: shiftDay(civilDate(period.startDate), -1),
  };
  const after = {
    from: shiftDay(civilDate(period.endDate), 1),
    through: next ? shiftDay(civilDate(next.startDate), -1) : null,
  };
  return {
    before: validBefore(before),
    after: validAfter(after),
  };
}

export function vacationAt(date: string, vacations: CalendarVacations): "before" | "after" | null {
  if (
    vacations.before &&
    date <= vacations.before.through &&
    (!vacations.before.from || date >= vacations.before.from)
  )
    return "before";
  if (
    vacations.after &&
    date >= vacations.after.from &&
    (!vacations.after.through || date <= vacations.after.through)
  )
    return "after";
  return null;
}

export function selectedCalendarPeriod(
  periods: CalendarPeriod[],
  { selectedId, year, today }: { selectedId: string | null; year: number; today: string },
): CalendarPeriod | null {
  const reference = today.startsWith(String(year)) ? today : `${year}-01-01`;
  return (
    periods.find((period) => period.id === selectedId) ??
    periods.find(
      (period) =>
        civilDate(period.startDate) <= reference && civilDate(period.endDate) >= reference,
    ) ??
    periods.find((period) => civilDate(period.startDate) > reference) ??
    periods.at(-1) ??
    null
  );
}

/** Keep the surrounding months visible; a cross-year period uses a continuous calendar. */
export function periodCalendarMonths(
  period: CalendarPeriod | null,
  { fallbackYear, periods = [] }: { fallbackYear: number; periods?: CalendarPeriod[] },
): CalendarMonth[] {
  const months = baseCalendarMonths(period, fallbackYear);
  const vacations = periodVacations(period, periods);
  const first = months[0]!;
  const last = months.at(-1)!;
  const before = vacations.before?.through;
  const after = vacations.after?.from;
  if (before && before < first.from && before >= "2000-01-01") {
    months.unshift(monthFromDate(before));
  }
  if (
    after &&
    after > isoDay({ year: last.year, month: last.month + 1, day: 0 }) &&
    after <= "2100-12-31"
  ) {
    months.push(monthFromDate(after));
  }
  return months;
}

export function mergeCalendarYears(first: AcademicYear, second?: AcademicYear): AcademicYear {
  if (!second) return first;
  return {
    periods: first.periods,
    closedDays: unique([...first.closedDays, ...second.closedDays]),
    events: unique([...first.events, ...second.events]),
    interruptions: unique([...first.interruptions, ...second.interruptions]),
    requests: unique([...first.requests, ...second.requests]),
    planWarnings: unique([...first.planWarnings, ...second.planWarnings]),
  };
}

function validBefore(
  before: NonNullable<CalendarVacations["before"]>,
): CalendarVacations["before"] {
  return before.through < "2000-01-01" || (before.from && before.from > before.through)
    ? null
    : before;
}
function validAfter(after: NonNullable<CalendarVacations["after"]>): CalendarVacations["after"] {
  return after.from > "2100-12-31" || (after.through && after.from > after.through) ? null : after;
}
function baseCalendarMonths(period: CalendarPeriod | null, fallbackYear: number): CalendarMonth[] {
  const year = period?.startDate.getUTCFullYear() ?? fallbackYear;
  const crossesYear = period && period.endDate.getUTCFullYear() !== year;
  const firstMonth = crossesYear ? period.startDate.getUTCMonth() : 0;
  const periodMonths = period
    ? (period.endDate.getUTCFullYear() - year) * MONTHS_PER_YEAR +
      period.endDate.getUTCMonth() -
      firstMonth +
      1
    : MONTHS_PER_YEAR;
  // A 366-day interval can touch 13 civil months; never hide its final days.
  return Array.from({ length: Math.max(MONTHS_PER_YEAR, periodMonths) }, (_value, index) => {
    const from = isoDay({ year, month: firstMonth + index, day: 1 });
    return monthFromDate(from);
  });
}
function monthFromDate(date: string): CalendarMonth {
  return {
    year: Number(date.slice(0, YEAR_LENGTH)),
    month: Number(date.slice(MONTH_START, MONTH_END)) - 1,
    from: `${date.slice(0, MONTH_END)}-01`,
  };
}
function unique<Row extends { id: string }>(rows: Row[]): Row[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}
