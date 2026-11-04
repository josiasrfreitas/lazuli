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
  // Only elapsed meetings on this business day are materialized, never a semester.
  const date = new Date(today);
  const missing = started.flatMap((row) =>
    !row.sessionId && row.slotId
      ? [
          {
            classId: row.classId,
            scheduleSlotId: row.slotId,
            date,
            startTime: timeStringToDate(row.startTime),
            endTime: timeStringToDate(row.endTime),
            usualTeacherId: row.usualTeacherId,
            responsibilityFrozenAt: input.now,
          },
        ]
      : [],
  );
  if (missing.length > 0) {
    await input.database.classSession.createMany({
      data: missing,
      skipDuplicates: true,
    });
  }
  const byTeacher = new Map<string | null, typeof started>();
  for (const row of started) {
    const group = byTeacher.get(row.usualTeacherId) ?? [];
    group.push(row);
    byTeacher.set(row.usualTeacherId, group);
  }
  for (const [usualTeacherId, rows] of byTeacher) {
    await input.database.classSession.updateMany({
      where: {
        OR: rows.map((row) =>
          row.sessionId
            ? { id: row.sessionId }
            : { classId: row.classId, scheduleSlotId: row.slotId, date },
        ),
        responsibilityFrozenAt: null,
      },
      data: { usualTeacherId, responsibilityFrozenAt: input.now },
    });
  }
}
