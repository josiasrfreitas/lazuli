import type { Period, AcademicInterruption, SchoolClosedDay } from "@lazuli/db/prisma";
import type { CalendarChange } from "./change-schema.js";
import { civil, day, datesBetween } from "./change-dates.js";
export function currentClosedDays(
  input: { interruptions: Pick<AcademicInterruption, "fromDate" | "throughDate">[]; closedDays: SchoolClosedDay[] },
): Set<string> {
  const closed = new Set(input.closedDays.filter((item) => !item.calendarManaged).map((item) => civil(item.date)));
  for (const item of input.interruptions)
    for (const date of datesBetween(civil(item.fromDate), civil(item.throughDate))) closed.add(date);
  return closed;
}
export function projectedClosedDays(
  change: CalendarChange,
  input: { interruptions: AcademicInterruption[]; closedDays: SchoolClosedDay[] },
): Set<string> {
  const { interruptions, closedDays } = input;
  const proposedInterruptions = interruptions.filter(
    (item) =>
      !(
        (change.action === "interruption" || change.action === "removeInterruption") &&
        item.id === change.id
      ),
  );
  const additions = interruptionAdditions(change, interruptions);
  return currentClosedDays({ interruptions: [...proposedInterruptions, ...additions], closedDays });
}
function interruptionAdditions(
  change: CalendarChange,
  interruptions: AcademicInterruption[],
): Pick<AcademicInterruption, "fromDate" | "throughDate" | "title">[] {
  if (change.action === "interruption")
    return [{ fromDate: day(change.from), throughDate: day(change.through), title: change.title }];
  if (change.action !== "holidays") return [];
  return change.dates
    .filter((item) => !interruptions.some((existing) => existing.sourceKey === item.sourceKey))
    .map((item) => ({ fromDate: day(item.date), throughDate: day(item.date), title: item.title }));
}
export function calendarChangeRange(
  change: CalendarChange,
  input: { period: Period | undefined; interruption: AcademicInterruption | undefined },
): string[] {
  const { period, interruption } = input;
  if (change.action === "removeInterruption")
    return [civil(interruption!.fromDate), civil(interruption!.throughDate)];
  if (change.action === "holidays") return change.dates.map((item) => item.date);
  return [
    change.from,
    change.through,
    ...(period ? [civil(period.startDate), civil(period.endDate)] : []),
    ...(interruption ? [civil(interruption.fromDate), civil(interruption.throughDate)] : []),
  ];
}
