import {
  computeCompensatedAttendance,
  teachingMinutes,
  intersectEnrollmentSemesterWindows,
  type AttendanceProgress,
} from "@lazuli/domain";
import type { Prisma } from "./generated/prisma/client.js";
type EnrollmentWindow = { id: string; classId: string; entryDate: Date; exitDate: Date | null };
type SemesterWindowDates = { startDate: Date; endDate: Date };
const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;
/** Confirmed home lessons define the denominator; completed source-linked compensation adds minutes. */
export async function computeEnrollmentPercentInWindow(input: {
  database: Pick<Prisma.TransactionClient, "classSession">;
  values: { enrollment: EnrollmentWindow; semester: SemesterWindowDates };
}): Promise<AttendanceProgress> {
  const window = intersectEnrollmentSemesterWindows(input.values);
  if (window === null) return computeCompensatedAttendance([]);
  const sessions = await input.database.classSession.findMany({
    where: {
      classId: input.values.enrollment.classId,
      deletedAt: null,
      status: "SCHEDULED",
      attendanceConfirmedAt: { not: null },
      // The exit date is the first day outside the roster; semester end remains inclusive.
      date: {
        gte: window.startDate,
        lte: window.endDate,
        ...(input.values.enrollment.exitDate ? { lt: input.values.enrollment.exitDate } : {}),
      },
    },
    select: {
      startTime: true,
      endTime: true,
      attendanceRows: {
        where: { enrollmentId: input.values.enrollment.id, deletedAt: null },
        select: {
          status: true,
          makeupCoverages: {
            where: { deletedAt: null, appointment: { deletedAt: null, status: "ATTENDED" } },
            select: { minutes: true },
          },
        },
      },
    },
  });
  return computeCompensatedAttendance(
    sessions.map((session) => {
      const attendance = session.attendanceRows[0];
      return {
        minutes: teachingMinutes({
          startTime: session.startTime
            .toISOString()
            .slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
          endTime: session.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
        }),
        status: attendance?.status ?? null,
        compensatedMinutes:
          attendance?.makeupCoverages.reduce((sum, row) => sum + row.minutes, 0) ?? 0,
      };
    }),
  );
}
