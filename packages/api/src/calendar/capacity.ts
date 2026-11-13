import type { Prisma } from "@lazuli/db";
import type { CalendarChangeState } from "./change-state.js";
import { civil, datesBetween, day } from "./change-state.js";

const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const minutes = (from: Date, through: Date) => (through.getTime() - from.getTime()) / 60000;
/** Compare real schedule duration with known program targets; never infer an unknown target. */
export async function calendarCapacity(
  database: Prisma.TransactionClient,
  state: CalendarChangeState,
) {
  const classes = await database.class.findMany({
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
    include: {
      scheduleSlots: { where: { deletedAt: null } },
      stagePlan: {
        include: {
          items: {
            where: { deletedAt: null },
            include: { programActivity: { select: { durationMinutes: true } } },
          },
        },
      },
    },
  });
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
  return classes.map((row) => {
    const period = state.proposedPeriods.find((item) => item.id === row.semesterId)!;
    const plan = row.stagePlan?.deletedAt ? null : row.stagePlan;
    const from = [
      civil(period.startDate),
      ...(row.startDate ? [civil(row.startDate)] : []),
      ...(plan ? [civil(plan.plannedStartOn)] : []),
    ]
      .sort()
      .at(-1)!;
    const through = [civil(period.endDate), ...(plan ? [civil(plan.plannedEndOn)] : [])].sort()[0]!;
    let availableMinutes = 0;
    for (const date of datesBetween(from, through)) {
      const actual = byClassDate.get(`${row.id}:${date}`) ?? [];
      for (const slot of row.scheduleSlots.filter(
        (item) => item.weekday === weekdays[day(date).getUTCDay()],
      )) {
        const existing = actual.find((item) => item.scheduleSlotId === slot.id);
        if (existing?.status === "CANCELLED" || (state.closed.has(date) && !existing?.classRecord))
          continue;
        availableMinutes += existing
          ? minutes(existing.startTime, existing.endTime)
          : minutes(slot.startTime, slot.endTime);
      }
      for (const session of actual.filter(
        (item) =>
          !item.scheduleSlotId &&
          item.status !== "CANCELLED" &&
          (!state.closed.has(date) || item.classRecord),
      ))
        availableMinutes += minutes(session.startTime, session.endTime);
    }
    const unknownItems =
      plan?.items.filter((item) => item.programActivity?.durationMinutes == null).length ?? 0;
    const requiredMinutes =
      plan?.items.length && !unknownItems
        ? plan.items.reduce(
            (total, item) => total + (item.programActivity?.durationMinutes ?? 0),
            0,
          )
        : null;
    return {
      classId: row.id,
      name: row.portalClassName,
      availableMinutes,
      requiredMinutes,
      unknownItems,
      deficitMinutes:
        requiredMinutes === null ? null : Math.max(0, requiredMinutes - availableMinutes),
    };
  });
}
