import { civilDate, isoDay, shiftDay } from "./date-model";
import type { AcademicYear } from "./model";

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
  const next = index >= 0 ? periods[index + 1] : undefined;
  const before = {
    from: previous ? shiftDay(civilDate(previous.endDate), 1) : null,
    through: shiftDay(civilDate(period.startDate), -1),
  };
  const after = {
    from: shiftDay(civilDate(period.endDate), 1),
    through: next ? shiftDay(civilDate(next.startDate), -1) : null,
  };
  return {
    before:
      before.through < "2000-01-01" || (before.from && before.from > before.through)
        ? null
        : before,
    after:
      after.from > "2100-12-31" || (after.through && after.from > after.through) ? null : after,
  };
}

export function vacationAt(date: string, vacations: CalendarVacations) {
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
  selectedId: string | null,
  year: number,
  today: string,
) {
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
  fallbackYear: number,
  periods: CalendarPeriod[] = [],
) {
  const year = period?.startDate.getUTCFullYear() ?? fallbackYear;
  const crossesYear = period && period.endDate.getUTCFullYear() !== year;
  const firstMonth = crossesYear ? period.startDate.getUTCMonth() : 0;
  const periodMonths = period
    ? (period.endDate.getUTCFullYear() - year) * 12 + period.endDate.getUTCMonth() - firstMonth + 1
    : 12;
  // A 366-day interval can touch 13 civil months; never hide its final days.
  const months = Array.from({ length: Math.max(12, periodMonths) }, (_, index) => {
    const from = isoDay(year, firstMonth + index, 1);
    return { year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) - 1, from };
  });
  const vacations = periodVacations(period, periods);
  const first = months[0]!;
  const last = months.at(-1)!;
  const before = vacations.before?.through;
  const after = vacations.after?.from;
  if (before && before < first.from && before >= "2000-01-01") {
    months.unshift({
      year: Number(before.slice(0, 4)),
      month: Number(before.slice(5, 7)) - 1,
      from: `${before.slice(0, 7)}-01`,
    });
  }
  if (after && after > isoDay(last.year, last.month + 1, 0) && after <= "2100-12-31") {
    months.push({
      year: Number(after.slice(0, 4)),
      month: Number(after.slice(5, 7)) - 1,
      from: `${after.slice(0, 7)}-01`,
    });
  }
  return months;
}

export function mergeCalendarYears(first: AcademicYear, second?: AcademicYear): AcademicYear {
  if (!second) return first;
  const unique = <T extends { id: string }>(rows: T[]) => [
    ...new Map(rows.map((row) => [row.id, row])).values(),
  ];
  return {
    periods: first.periods,
    closedDays: unique([...first.closedDays, ...second.closedDays]),
    events: unique([...first.events, ...second.events]),
    interruptions: unique([...first.interruptions, ...second.interruptions]),
    requests: unique([...first.requests, ...second.requests]),
    planWarnings: unique([...first.planWarnings, ...second.planWarnings]),
  };
}
