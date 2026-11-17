import { civilDate, isoDay, shiftDay } from "./date-model";
import type { AcademicYear } from "./model";

const MONTHS_PER_YEAR = 12;
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
  return {
    before: previous
      ? validBefore({
          from: shiftDay(civilDate(previous.endDate), 1),
          through: shiftDay(civilDate(period.startDate), -1),
        })
      : null,
    after: next
      ? validAfter({
          from: shiftDay(civilDate(period.endDate), 1),
          through: shiftDay(civilDate(next.startDate), -1),
        })
      : null,
  };
}

/** A lone period includes one neighboring vacation month, without creating calendar records. */
export function calendarYearVacations(periods: CalendarPeriod[], year: number): CalendarVacations {
  const visible = calendarPeriodsInYear(periods, year);
  if (visible.length !== 1) return { before: null, after: null };
  const period = visible[0]!;
  const ordered = periods.toSorted(
    (first, second) => first.startDate.getTime() - second.startDate.getTime(),
  );
  const vacations = periodVacations(period, ordered);
  const index = ordered.findIndex((row) => row.id === period.id);
  if (index === 0)
    vacations.before = validBefore({
      from: isoDay({
        year: period.startDate.getUTCFullYear(),
        month: period.startDate.getUTCMonth() - 1,
        day: 1,
      }),
      through: shiftDay(civilDate(period.startDate), -1),
    });
  if (index === ordered.length - 1)
    vacations.after = validAfter({
      from: shiftDay(civilDate(period.endDate), 1),
      through: isoDay({
        year: period.endDate.getUTCFullYear(),
        month: period.endDate.getUTCMonth() + 2,
        day: 0,
      }),
    });
  return vacations;
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

export function calendarPeriodsInYear(periods: CalendarPeriod[], year: number): CalendarPeriod[] {
  return periods
    .filter(
      (period) =>
        civilDate(period.startDate) <= `${year}-12-31` &&
        civilDate(period.endDate) >= `${year}-01-01`,
    )
    .toSorted((first, second) => first.startDate.getTime() - second.startDate.getTime());
}

export function calendarVacationRanges(
  periods: CalendarPeriod[],
  year: number,
): { from: string; through: string }[] {
  const ordered = periods.toSorted(
    (first, second) => first.startDate.getTime() - second.startDate.getTime(),
  );
  const visible = calendarPeriodsInYear(ordered, year);
  if (visible.length === 1) {
    const vacations = calendarYearVacations(ordered, year);
    return [vacations.before, vacations.after].flatMap((range) =>
      range?.from &&
      range.through &&
      range.from <= `${year}-12-31` &&
      range.through >= `${year}-01-01`
        ? [{ from: range.from, through: range.through }]
        : [],
    );
  }
  return ordered.flatMap((period) => {
    const range = periodVacations(period, ordered).after;
    return range?.through && range.from <= `${year}-12-31` && range.through >= `${year}-01-01`
      ? [{ from: range.from, through: range.through }]
      : [];
  });
}

/** Show configured months and the gaps between them within one civil year. */
export function periodCalendarMonths(
  period: CalendarPeriod | null,
  { fallbackYear, periods = [] }: { fallbackYear: number; periods?: CalendarPeriod[] },
): CalendarMonth[] {
  const visible = calendarPeriodsInYear(period ? [period] : periods, fallbackYear);
  if (visible.length === 0) return [];
  const boundaryMonths = visible.length === 1 ? 1 : 0;
  const firstMonth = Math.max(
    0,
    (visible[0]!.startDate.getUTCFullYear() === fallbackYear
      ? visible[0]!.startDate.getUTCMonth()
      : 0) - boundaryMonths,
  );
  const lastDate = new Date(Math.max(...visible.map((row) => row.endDate.getTime())));
  const lastMonth = Math.min(
    MONTHS_PER_YEAR - 1,
    (lastDate.getUTCFullYear() > fallbackYear ? MONTHS_PER_YEAR - 1 : lastDate.getUTCMonth()) +
      boundaryMonths,
  );
  return Array.from({ length: lastMonth - firstMonth + 1 }, (_value, index) => ({
    year: fallbackYear,
    month: firstMonth + index,
    from: isoDay({ year: fallbackYear, month: firstMonth + index, day: 1 }),
  }));
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
