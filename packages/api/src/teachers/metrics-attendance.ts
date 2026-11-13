import type { Prisma } from "@lazuli/db";
import { sessionEndInstant, teachingMinutes, saoPauloDateOnly } from "@lazuli/domain";
import { inWindow } from "./metric-rules.js";
import { teacherResponsibilityPeriods } from "./responsibility.js";

type MetricClass = Parameters<typeof teacherResponsibilityPeriods>[0] & {
  id: string;
  semester: { startDate: Date; endDate: Date };
  enrollments: { id: string; studentId: string; entryDate: Date; exitDate: Date | null }[];
};
/** Only small attendance facts are loaded; no lesson snapshots or file bodies. */
export async function metricAttendance(
  database: Prisma.TransactionClient,
  input: {
    classes: MetricClass[];
    teacherId: string;
    now: Date;
  },
) {
  if (!input.classes.length) return { students: [], classes: [] };
  const substitutions = await database.classSubstitution.findMany({
    where: {
      classId: { in: input.classes.map((group) => group.id) },
      deletedAt: null,
      revokedAt: null,
      date: {
        gte: new Date(
          Math.min(...input.classes.map((group) => group.semester.startDate.getTime())),
        ),
        lte: new Date(saoPauloDateOnly(input.now)),
      },
    },
    select: {
      classId: true,
      classSessionId: true,
      scheduleSlotId: true,
      date: true,
      teacherId: true,
    },
  });
  const bySession = new Map(
    substitutions
      .filter((row) => row.classSessionId !== null)
      .map((row) => [row.classSessionId, row.teacherId]),
  );
  const bySlot = new Map(
    substitutions
      .filter((row) => row.classSessionId === null && row.scheduleSlotId !== null)
      .map((row) => [
        `${row.classId}:${row.date.toISOString().slice(0, 10)}:${row.scheduleSlotId}`,
        row.teacherId,
      ]),
  );
  const sessions = await database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      OR: input.classes.map((group) => ({
        classId: group.id,
        date: { gte: group.semester.startDate, lte: new Date(saoPauloDateOnly(input.now)) },
      })),
    },
    select: {
      id: true,
      scheduleSlotId: true,
      classId: true,
      date: true,
      startTime: true,
      endTime: true,
      attendanceConfirmedAt: true,
      classRecord: { select: { deletedAt: true, teachingTeacherId: true } },
      attendanceRows: {
        where: { deletedAt: null },
        select: {
          enrollmentId: true,
          status: true,
          makeupCoverages: {
            where: {
              deletedAt: null,
              appointment: {
                deletedAt: null,
                status: "ATTENDED",
                date: { lte: new Date(saoPauloDateOnly(input.now)) },
              },
            },
            select: { minutes: true },
          },
        },
      },
    },
  });
  const classCalls: { classId: string; due: number; confirmed: number }[] = [];
  const students = input.classes.flatMap((group) => {
    const periods = teacherResponsibilityPeriods(group, input.teacherId);
    const own = sessions.filter((session) => {
      if (session.classId !== group.id) return false;
      const date = session.date.toISOString().slice(0, 10);
      const endTime = session.endTime.toISOString().slice(11, 16);
      if (sessionEndInstant({ date, endTime }) > input.now) return false;
      const actual = !session.classRecord?.deletedAt
        ? session.classRecord?.teachingTeacherId
        : null;
      const substitute =
        bySession.get(session.id) ??
        bySlot.get(`${session.classId}:${date}:${session.scheduleSlotId}`);
      if (actual || substitute) return (actual ?? substitute) === input.teacherId;
      return periods.some((period) => inWindow(session.date, period));
    });
    classCalls.push({
      classId: group.id,
      due: own.length,
      confirmed: own.filter((session) => session.attendanceConfirmedAt).length,
    });
    return group.enrollments.map((enrollment) => {
      const total = {
        studentId: enrollment.studentId,
        classId: group.id,
        heldMinutes: 0,
        absentMinutes: 0,
        compensatedMinutes: 0,
        missingRows: 0,
        due: 0,
        confirmed: 0,
      };
      for (const session of own) {
        if (!inWindow(session.date, { start: enrollment.entryDate, end: enrollment.exitDate }))
          continue;
        total.due += 1;
        if (!session.attendanceConfirmedAt) continue;
        total.confirmed += 1;
        const attendance = session.attendanceRows.find((row) => row.enrollmentId === enrollment.id);
        if (!attendance) {
          total.missingRows += 1;
          continue;
        }
        const minutes = teachingMinutes({
          startTime: session.startTime.toISOString().slice(11, 16),
          endTime: session.endTime.toISOString().slice(11, 16),
        });
        total.heldMinutes += minutes;
        if (attendance.status !== "ABSENT") continue;
        total.absentMinutes += minutes;
        total.compensatedMinutes += Math.min(
          minutes,
          Math.max(
            0,
            attendance.makeupCoverages.reduce((sum, row) => sum + row.minutes, 0),
          ),
        );
      }
      return total;
    });
  });
  return { students, classes: classCalls };
}
