import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
type MonthlyHours = { plannedMinutes: number; completedMinutes: number };

/** Class-linked appointments share the class slot and must not add teaching time twice. */
export async function teacherAppointmentHours(
  database: Prisma.TransactionClient,
  { teacherIds, now }: { teacherIds: string[]; now: Date },
): Promise<Map<string, MonthlyHours>> {
  const totals = new Map(teacherIds.map((id) => [id, { plannedMinutes: 0, completedMinutes: 0 }]));
  if (!teacherIds.length) return totals;
  const from = new Date(saoPauloDateOnly(now).slice(0, 7) + "-01");
  const until = new Date(from);
  until.setUTCMonth(until.getUTCMonth() + 1);
  const appointments = await database.pedagogicalAppointment.findMany({
    where: {
      deletedAt: null,
      teacherId: { in: teacherIds },
      targetClassSessionId: null,
      status: { not: "CANCELLED" },
      date: { gte: from, lt: until },
    },
    select: {
      teacherId: true,
      startTime: true,
      endTime: true,
      status: true,
      performedMinutes: true,
    },
  });
  for (const appointment of appointments) {
    const total = appointment.teacherId ? totals.get(appointment.teacherId) : undefined;
    if (!total) continue;
    const planned = (appointment.endTime.getTime() - appointment.startTime.getTime()) / 60_000;
    total.plannedMinutes += planned;
    if (appointment.status === "ATTENDED")
      total.completedMinutes += appointment.performedMinutes ?? planned;
  }
  return totals;
}
