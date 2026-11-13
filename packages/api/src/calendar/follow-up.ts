import type { Prisma } from "@lazuli/db";
import { civil } from "./change-state.js";
export async function calendarPlanWarnings(database: Prisma.TransactionClient, year: number) {
  const [items, closedDays] = await Promise.all([
    database.stagePlanItem.findMany({
      where: {
        deletedAt: null,
        plannedOn: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        plan: { deletedAt: null },
      },
      include: {
        plan: {
          select: {
            classId: true,
            class: {
              select: {
                portalClassName: true,
                semester: { select: { startDate: true, endDate: true } },
              },
            },
            student: { select: { fullName: true } },
          },
        },
      },
      orderBy: { plannedOn: "asc" },
    }),
    database.schoolClosedDay.findMany({
      where: {
        deletedAt: null,
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
      },
      select: { date: true },
    }),
  ]);
  const blocked = new Set(closedDays.map((row) => civil(row.date)));
  return items
    .filter(
      (row) =>
        blocked.has(civil(row.plannedOn)) ||
        (row.plan.class &&
          (row.plannedOn < row.plan.class.semester.startDate ||
            row.plannedOn > row.plan.class.semester.endDate)),
    )
    .map((row) => ({
      id: row.id,
      date: civil(row.plannedOn),
      title: row.title,
      classId: row.plan.classId,
      name: row.plan.class?.portalClassName ?? row.plan.student?.fullName ?? "Plano individual",
    }));
}
