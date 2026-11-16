import type { Prisma } from "@lazuli/db";
import { validateCalendarPeriod, validateCalendarVersion } from "./change-validation.js";
import { projectedClosedDays, calendarChangeRange } from "./change-projection.js";
import type { Period, AcademicInterruption, SchoolClosedDay } from "@lazuli/db/prisma";
import type { CalendarChange } from "./change-schema.js";

import { day } from "./change-dates.js";
export { civil, day, datesBetween } from "./change-dates.js";
export async function calendarChangeState(
  database: Prisma.TransactionClient,
  change: CalendarChange,
): Promise<CalendarChangeState> {
  const [periods, interruptions, closedDays] = await Promise.all([
    database.period.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    database.academicInterruption.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    database.schoolClosedDay.findMany({ where: { deletedAt: null }, orderBy: { date: "asc" } }),
  ]);
  const period =
    change.action === "period" && change.id
      ? periods.find((item) => item.id === change.id)
      : undefined;
  const interruption =
    (change.action === "interruption" || change.action === "removeInterruption") && change.id
      ? interruptions.find((item) => item.id === change.id)
      : undefined;
  validateCalendarVersion(change, { period, interruption });
  if (change.action === "period")
    await validateCalendarPeriod(database, { change, periods, period });
  const proposedPeriods =
    change.action === "period"
      ? [
          ...periods.filter((item) => item.id !== change.id),
          {
            id: change.id ?? "new",
            name: change.name,
            startDate: day(change.from),
            endDate: day(change.through),
          },
        ]
      : periods;
  const closed = projectedClosedDays(change, { interruptions, closedDays });
  const range = calendarChangeRange(change, { period, interruption });
  range.sort();
  return {
    periods,
    interruptions,
    closedDays,
    period,
    interruption,
    proposedPeriods,
    closed,
    from: range[0]!,
    through: range.at(-1)!,
  };
}
export type CalendarChangeState = {
  periods: Period[];
  interruptions: AcademicInterruption[];
  closedDays: SchoolClosedDay[];
  period: Period | undefined;
  interruption: AcademicInterruption | undefined;
  proposedPeriods: Pick<Period, "id" | "name" | "startDate" | "endDate">[];
  closed: Set<string>;
  from: string;
  through: string;
};
