import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, teachingMinutes } from "@lazuli/domain";
import { dateToTimeString } from "../classes/time.js";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";

/** Recurring timetable of the teacher's current classes, independent of dated exceptions. */
export async function teacherAgenda({
  database,
  teacherId,
  now,
}: {
  database: Prisma.TransactionClient;
  teacherId: string;
  now: Date;
}) {
  const today = new Date(saoPauloDateOnly(now));
  const classes = await database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      OR: [{ teacherId }, { teacherAssignments: { some: { teacherId, supersededAt: null } } }],
    },
    orderBy: [{ internalCode: "asc" }, { id: "asc" }],
    select: {
      ...responsibilitySelect,
      id: true,
      internalCode: true,
      portalClassName: true,
      scheduleType: true,
      format: true,
      sharedStage: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        orderBy: [{ startTime: "asc" }, { id: "asc" }],
        select: { id: true, weekday: true, startTime: true, endTime: true },
      },
    },
  });
  const rows = classes
    .filter((row) => usualTeacherOn(row, today)?.id === teacherId)
    .flatMap((row) =>
      row.scheduleSlots.map((slot) => {
        const startTime = dateToTimeString(slot.startTime);
        const endTime = dateToTimeString(slot.endTime);
        return {
          id: slot.id,
          weekday: slot.weekday,
          startTime,
          endTime,
          classId: row.id,
          className: row.portalClassName,
          classCode: row.internalCode,
          scheduleType: row.scheduleType,
          format: row.format,
          stageName: row.sharedStage?.name ?? null,
          minutes: teachingMinutes({ startTime, endTime }),
        };
      }),
    );
  return { rows, minutes: rows.reduce((total, row) => total + row.minutes, 0) };
}
