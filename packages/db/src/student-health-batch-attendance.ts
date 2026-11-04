import {
  computeCompensatedAttendance,
  intersectEnrollmentSemesterWindows,
  teachingMinutes,
  type AttendanceProgress,
} from "@lazuli/domain";
import type { AttendanceStatus, Prisma } from "./generated/prisma/client.js";
import type { HealthEnrollment } from "./student-health.js";

const TIME_START = 11;
const TIME_END = 16;

export async function readHealthAttendanceBatch(input: {
  database: Pick<Prisma.TransactionClient, "classSession">;
  enrollments: Array<HealthEnrollment & { studentId: string }>;
  today: Date;
}): Promise<Array<AttendanceProgress & { studentId: string }>> {
  const windows = input.enrollments.flatMap((enrollment) => {
    const window = intersectEnrollmentSemesterWindows({
      enrollment,
      semester: { ...enrollment.class.semester, endDate: input.today },
    });
    return window ? [{ ...window, enrollment }] : [];
  });
  if (windows.length === 0) return [];
  const sessions = await readSessions(input.database, windows);
  return summarizeAttendance({ windows, sessions });
}

type HealthWindow = {
  startDate: Date;
  endDate: Date;
  enrollment: HealthEnrollment & { studentId: string };
};
type HealthSession = {
  classId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  attendanceRows: Array<{
    enrollmentId: string;
    status: AttendanceStatus;
    makeupCoverages: Array<{ minutes: number }>;
  }>;
};
async function readSessions(
  database: Pick<Prisma.TransactionClient, "classSession">,
  windows: HealthWindow[],
): Promise<HealthSession[]> {
  return database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      attendanceConfirmedAt: { not: null },
      OR: windows.map(({ enrollment, startDate, endDate }) => ({
        classId: enrollment.classId,
        date: {
          gte: startDate,
          lte: endDate,
          ...(enrollment.exitDate ? { lt: enrollment.exitDate } : {}),
        },
      })),
    },
    select: {
      classId: true,
      date: true,
      startTime: true,
      endTime: true,
      attendanceRows: {
        where: { enrollmentId: { in: windows.map((row) => row.enrollment.id) }, deletedAt: null },
        select: {
          enrollmentId: true,
          status: true,
          makeupCoverages: {
            where: { deletedAt: null, appointment: { deletedAt: null, status: "ATTENDED" } },
            select: { minutes: true },
          },
        },
      },
    },
  });
}

function summarizeAttendance({
  windows,
  sessions,
}: {
  windows: HealthWindow[];
  sessions: Awaited<ReturnType<typeof readSessions>>;
}): Array<AttendanceProgress & { studentId: string }> {
  return windows.map(({ enrollment, startDate, endDate }) => ({
    studentId: enrollment.studentId,
    ...computeCompensatedAttendance(
      sessions
        .filter(
          (session) =>
            session.classId === enrollment.classId &&
            session.date >= startDate &&
            session.date <= endDate &&
            (!enrollment.exitDate || session.date < enrollment.exitDate),
        )
        .map((session) => {
          const row = session.attendanceRows.find(
            (attendance) => attendance.enrollmentId === enrollment.id,
          );
          return {
            minutes: teachingMinutes({
              startTime: session.startTime.toISOString().slice(TIME_START, TIME_END),
              endTime: session.endTime.toISOString().slice(TIME_START, TIME_END),
            }),
            status: row?.status ?? null,
            compensatedMinutes:
              row?.makeupCoverages.reduce((sum, coverage) => sum + coverage.minutes, 0) ?? 0,
          };
        }),
    ),
  }));
}
