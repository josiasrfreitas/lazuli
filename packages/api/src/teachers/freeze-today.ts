import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { timeStringToDate } from "../classes/time.js";
import { meetingsBetween } from "./schedule.js";

/** A change effective today must not rewrite the responsibility of meetings already started. */
export async function freezeStartedMeetings(input: {
  database: Prisma.TransactionClient;
  effectiveDate: string;
  now: Date;
  teacherId?: string;
  classId?: string;
}): Promise<void> {
  const today = saoPauloDateOnly(input.now);
  if (input.effectiveDate !== today) return;
  const rows = await meetingsBetween({
    database: input.database,
    from: today,
    through: today,
    now: input.now,
  });
  const started = rows.filter(
    (row) =>
      (input.classId
        ? row.classId === input.classId
        : row.usualTeacherId === input.teacherId || row.substituteTeacherId === input.teacherId) &&
      sessionEndInstant({ date: row.date, endTime: row.startTime }) <= input.now,
  );
  // Only the elapsed meetings on this business day are materialized, never a semester.
  for (const row of started) {
    if (!row.sessionId && row.slotId) {
      await input.database.classSession.createMany({
        data: [
          {
            classId: row.classId,
            scheduleSlotId: row.slotId,
            date: new Date(today),
            startTime: timeStringToDate(row.startTime),
            endTime: timeStringToDate(row.endTime),
            usualTeacherId: row.usualTeacherId,
            responsibilityFrozenAt: input.now,
          },
        ],
        skipDuplicates: true,
      });
    }
    await input.database.classSession.updateMany({
      where: {
        ...(row.sessionId
          ? { id: row.sessionId }
          : { classId: row.classId, scheduleSlotId: row.slotId, date: new Date(today) }),
        responsibilityFrozenAt: null,
      },
      data: { usualTeacherId: row.usualTeacherId, responsibilityFrozenAt: input.now },
    });
  }
}
