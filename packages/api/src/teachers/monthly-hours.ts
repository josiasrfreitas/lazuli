import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, saoPauloDateOnly } from "@lazuli/domain";
import { meetingsBetween } from "./schedule.js";

const DATE_LENGTH = 10;
const MONTH_LENGTH = 7;
const MILLISECONDS_PER_MINUTE = 60_000;
export type MonthlyHours = { plannedMinutes: number; completedMinutes: number };

export async function teacherMonthlyHours(
  database: Prisma.TransactionClient,
  { teacherIds, now }: { teacherIds: string[]; now: Date },
): Promise<Map<string, MonthlyHours>> {
  const result = new Map(teacherIds.map((id) => [id, { plannedMinutes: 0, completedMinutes: 0 }]));
  if (teacherIds.length === 0) return result;
  const from = `${saoPauloDateOnly(now).slice(0, MONTH_LENGTH)}-01`;
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  const through = end.toISOString().slice(0, DATE_LENGTH);
  const meetings = await meetingsBetween({ database, from, through, now });
  for (const meeting of meetings) {
    const teacherId = responsibleTeacherId(meeting);
    const totals = teacherId ? result.get(teacherId) : undefined;
    if (totals) totals.plannedMinutes += meeting.minutes;
  }
  const records = await database.classSessionRecord.findMany({
    where: {
      deletedAt: null,
      teachingTeacherId: { in: teacherIds },
      classSession: {
        deletedAt: null,
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        date: { gte: new Date(from), lte: end },
        class: { deletedAt: null },
      },
    },
    select: {
      teachingTeacherId: true,
      classSession: { select: { startTime: true, endTime: true } },
    },
  });
  for (const record of records) {
    const totals = record.teachingTeacherId ? result.get(record.teachingTeacherId) : undefined;
    if (totals)
      totals.completedMinutes +=
        (record.classSession.endTime.getTime() - record.classSession.startTime.getTime()) /
        MILLISECONDS_PER_MINUTE;
  }
  return result;
}
