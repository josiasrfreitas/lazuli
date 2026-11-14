import type { Prisma } from "@lazuli/db";
import { sessionEndInstant, teachingMinutes, saoPauloDateOnly } from "@lazuli/domain";
import { inWindow, type AttendanceTotals } from "./metric-rules.js";
import { teacherResponsibilityPeriods } from "./responsibility.js";

const ISO_DATE_LENGTH = 10;
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;
export type AttendanceEvidence = {
  students: (AttendanceTotals & { studentId: string; classId: string })[];
  classes: { classId: string; due: number; confirmed: number }[];
};
type MetricInput = { classes: MetricClass[]; teacherId: string; now: Date };
const attendanceSelect = {
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
          },
        },
        select: { minutes: true },
      },
    },
  },
} as const satisfies Prisma.ClassSessionSelect;
const substitutionSelect = {
  classId: true,
  classSessionId: true,
  scheduleSlotId: true,
  date: true,
  teacherId: true,
} as const satisfies Prisma.ClassSubstitutionSelect;
type AttendanceSession = Prisma.ClassSessionGetPayload<{ select: typeof attendanceSelect }>;
export type AttendanceDatabase = {
  classSession: {
    findMany(input: {
      where: Prisma.ClassSessionWhereInput;
      select: typeof attendanceSelect;
    }): Promise<AttendanceSession[]>;
  };
  classSubstitution: {
    findMany(input: {
      where: Prisma.ClassSubstitutionWhereInput;
      select: typeof substitutionSelect;
    }): Promise<Prisma.ClassSubstitutionGetPayload<{ select: typeof substitutionSelect }>[]>;
  };
};
type SubstitutionMaps = { bySession: Map<string | null, string>; bySlot: Map<string, string> };
type MetricClass = Parameters<typeof teacherResponsibilityPeriods>[0] & {
  id: string;
  semester: { startDate: Date; endDate: Date };
  enrollments: { id: string; studentId: string; entryDate: Date; exitDate: Date | null }[];
};
/** Only small attendance facts are loaded; no lesson snapshots or file bodies. */
export async function metricAttendance(
  database: AttendanceDatabase,
  input: MetricInput,
): Promise<AttendanceEvidence> {
  if (input.classes.length === 0) return { students: [], classes: [] };
  const { bySession, bySlot } = await readSubstitutions(database, input);
  const sessions = await readSessions(database, input);
  const classCalls: { classId: string; due: number; confirmed: number }[] = [];
  const students = input.classes.flatMap((group) => {
    const periods = teacherResponsibilityPeriods(group, input.teacherId);
    const own = sessions.filter((session) => {
      if (session.classId !== group.id) return false;
      const date = session.date.toISOString().slice(0, ISO_DATE_LENGTH);
      const endTime = session.endTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END);
      if (sessionEndInstant({ date, endTime }) > input.now) return false;
      const actual = session.classRecord?.deletedAt ? null : session.classRecord?.teachingTeacherId;
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
          startTime: session.startTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END),
          endTime: session.endTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END),
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

async function readSubstitutions(
  database: AttendanceDatabase,
  input: MetricInput,
): Promise<SubstitutionMaps> {
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
    select: substitutionSelect,
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
        `${row.classId}:${row.date.toISOString().slice(0, ISO_DATE_LENGTH)}:${row.scheduleSlotId}`,
        row.teacherId,
      ]),
  );
  return { bySession, bySlot };
}

async function readSessions(
  database: AttendanceDatabase,
  input: MetricInput,
): Promise<AttendanceSession[]> {
  const rows = attendanceSelect.attendanceRows;
  const coverages = rows.select.makeupCoverages;
  const select = {
    ...attendanceSelect,
    attendanceRows: {
      ...rows,
      select: {
        ...rows.select,
        makeupCoverages: {
          ...coverages,
          where: {
            ...coverages.where,
            appointment: {
              ...coverages.where.appointment,
              date: { lte: new Date(saoPauloDateOnly(input.now)) },
            },
          },
        },
      },
    },
  };
  return database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      OR: input.classes.map((group) => ({
        classId: group.id,
        date: { gte: group.semester.startDate, lte: new Date(saoPauloDateOnly(input.now)) },
      })),
    },
    select,
  });
}
