import type { Prisma } from "@lazuli/db";
import type { CalendarChangeState } from "./change-state.js";
import { civil, datesBetween, day } from "./change-state.js";

const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MINUTE_MILLISECONDS = 60_000;
const minutes = (from: Date, through: Date): number =>
  (through.getTime() - from.getTime()) / MINUTE_MILLISECONDS;
/** Compare real schedule duration with known program targets; never infer an unknown target. */
export async function calendarCapacity(
  database: Prisma.TransactionClient,
  state: CalendarChangeState,
): Promise<CalendarCapacity[]> {
  const classes = await readCapacityClasses(database, state);
  const sessions = await database.classSession.findMany({
    where: { deletedAt: null, classId: { in: classes.map((row) => row.id) } },
    include: { classRecord: { select: { id: true } } },
  });
  const byClassDate = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = `${session.classId}:${civil(session.date)}`;
    const rows = byClassDate.get(key) ?? [];
    rows.push(session);
    byClassDate.set(key, rows);
  }
  return classes.map((row) => classCapacity(row, { state, byClassDate }));
}

type CalendarCapacity = {
  classId: string;
  name: string;
  availableMinutes: number;
  requiredMinutes: number | null;
  unknownItems: number;
  deficitMinutes: number | null;
};
const capacityInclude = {
  scheduleSlots: { where: { deletedAt: null } },
  stagePlan: {
    include: {
      items: {
        where: { deletedAt: null },
        include: { programActivity: { select: { durationMinutes: true } } },
      },
    },
  },
} as const;
type CapacityClass = Prisma.ClassGetPayload<{ include: typeof capacityInclude }>;
type CapacitySession = Prisma.ClassSessionGetPayload<{
  include: { classRecord: { select: { id: true } } };
}>;
type CapacityPlan = CapacityClass["stagePlan"];
async function readCapacityClasses(
  database: Prisma.TransactionClient,
  state: CalendarChangeState,
): Promise<CapacityClass[]> {
  return database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      ...(state.period
        ? { semesterId: state.period.id }
        : {
            semester: {
              deletedAt: null,
              startDate: { lte: day(state.through) },
              endDate: { gte: day(state.from) },
            },
          }),
    },
    orderBy: { portalClassName: "asc" },
    include: capacityInclude,
  });
}
function classCapacity(
  row: CapacityClass,
  input: { state: CalendarChangeState; byClassDate: Map<string, CapacitySession[]> },
): CalendarCapacity {
  const { state, byClassDate } = input;

  const period = state.proposedPeriods.find((item) => item.id === row.semesterId)!;
  const plan = row.stagePlan?.deletedAt ? null : row.stagePlan;
  const from = [
    civil(period.startDate),
    ...(row.startDate ? [civil(row.startDate)] : []),
    ...(plan ? [civil(plan.plannedStartOn)] : []),
  ]
    .toSorted()
    .at(-1)!;
  const through = [
    civil(period.endDate),
    ...(plan ? [civil(plan.plannedEndOn)] : []),
  ].toSorted()[0]!;
  let availableMinutes = 0;
  for (const date of datesBetween(from, through)) {
    availableMinutes += dateCapacity(row, {
      date,
      actual: byClassDate.get(`${row.id}:${date}`) ?? [],
      closed: state.closed,
    });
  }
  const { unknownItems, requiredMinutes } = planRequirements(plan);
  return {
    classId: row.id,
    name: row.portalClassName,
    availableMinutes,
    requiredMinutes,
    unknownItems,
    deficitMinutes:
      requiredMinutes === null ? null : Math.max(0, requiredMinutes - availableMinutes),
  };
}
function dateCapacity(
  row: CapacityClass,
  input: { date: string; actual: CapacitySession[]; closed: Set<string> },
): number {
  const { date, actual, closed } = input;
  let availableMinutes = 0;
  for (const slot of row.scheduleSlots.filter(
    (item) => item.weekday === weekdays[day(date).getUTCDay()],
  )) {
    const existing = actual.find((item) => item.scheduleSlotId === slot.id);
    if (existing?.status === "CANCELLED" || (closed.has(date) && !existing?.classRecord)) continue;
    availableMinutes += existing
      ? minutes(existing.startTime, existing.endTime)
      : minutes(slot.startTime, slot.endTime);
  }
  for (const session of actual.filter(
    (item) =>
      !item.scheduleSlotId &&
      item.status !== "CANCELLED" &&
      (!closed.has(date) || item.classRecord),
  ))
    availableMinutes += minutes(session.startTime, session.endTime);
  return availableMinutes;
}
function planRequirements(plan: CapacityPlan): {
  unknownItems: number;
  requiredMinutes: number | null;
} {
  const unknownItems =
    plan?.items.filter(
      (item) =>
        item.programActivity?.durationMinutes === null ||
        item.programActivity?.durationMinutes === undefined,
    ).length ?? 0;
  const requiredMinutes =
    plan?.items.length && !unknownItems
      ? plan.items.reduce((total, item) => total + (item.programActivity?.durationMinutes ?? 0), 0)
      : null;
  return { unknownItems, requiredMinutes };
}
