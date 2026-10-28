import {
  calculateStudentHealth,
  intersectEnrollmentSemesterWindows,
  saoPauloDateOnly,
} from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { computeEnrollmentPercentInWindow } from "../attendance/percent.js";
import type { Context } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";

const DATE_ONLY_LENGTH = 10;
const healthEnrollmentSelect = (today: Date) =>
  ({
    id: true,
    classId: true,
    entryDate: true,
    exitDate: true,
    class: { select: { semester: { select: { startDate: true, endDate: true } } } },
    progressRecords: {
      where: { deletedAt: null, startDate: { lte: today } },
      select: {
        assessment: {
          select: {
            deletedAt: true,
            grades: {
              where: { deletedAt: null, assessedOn: { lte: today } },
              select: { id: true, score: true, assessedOn: true },
            },
          },
        },
      },
    },
  }) as const;
type HealthEnrollment = Prisma.EnrollmentGetPayload<{
  select: ReturnType<typeof healthEnrollmentSelect>;
}>;
type HealthWindow = { classId: string; exitDate: Date | null; startDate: Date; endDate: Date };
type HealthOccurrence = { interventions: Array<{ interventionId: string }> };
type HealthResult = ReturnType<typeof calculateStudentHealth> & {
  from: string | null;
  through: string;
  heldSessions: number;
  gradeCount: number;
  occurrenceCount: number;
  accompaniedOccurrences: number;
  interventionCount: number;
};

export async function readStudentHealth({
  database,
  id,
  now,
}: {
  database: Context["db"];
  id: string;
  now: Date;
}): Promise<HealthResult> {
  await assertStudentExists(database, id);
  const today = new Date(saoPauloDateOnly(now));
  const enrollments = await activeHealthEnrollments(database, { id, today });
  const windows = healthWindows(enrollments);
  const [attendance, occurrences] = await Promise.all([
    healthAttendance(database, { enrollments, today }),
    healthOccurrences(database, { id, today, windows }),
  ]);
  const minutes = attendance.reduce((sum, row) => sum + row.heldMinutes, 0);
  const attended = attendance.reduce(
    (sum, row) => sum + row.presentMinutes + row.compensatedMinutes,
    0,
  );
  const grades = healthGrades(enrollments);
  const heldSessions = attendance.reduce((sum, row) => sum + row.heldSessions, 0);
  const accompaniedOccurrences = occurrences.filter((row) => row.interventions.length > 0).length;
  return {
    ...calculateStudentHealth({
      attendancePercent: minutes > 0 ? attended / minutes : null,
      grades,
      heldSessions,
      occurrenceCount: occurrences.length,
      accompaniedOccurrences,
    }),
    from:
      windows
        .map((window) => window.startDate.toISOString().slice(0, DATE_ONLY_LENGTH))
        .toSorted()[0] ?? null,
    through: saoPauloDateOnly(now),
    heldSessions,
    gradeCount: grades.length,
    occurrenceCount: occurrences.length,
    accompaniedOccurrences,
    interventionCount: new Set(
      occurrences.flatMap((row) => row.interventions.map((link) => link.interventionId)),
    ).size,
  };
}

async function assertStudentExists(database: Context["db"], id: string): Promise<void> {
  const student = await database.student.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
}

function healthAttendance(
  database: Context["db"],
  { enrollments, today }: { enrollments: HealthEnrollment[]; today: Date },
): Promise<Array<Awaited<ReturnType<typeof computeEnrollmentPercentInWindow>>>> {
  return Promise.all(
    enrollments.map((enrollment) =>
      computeEnrollmentPercentInWindow({
        database,
        values: {
          enrollment,
          semester: { ...enrollment.class.semester, endDate: today },
        },
      }),
    ),
  );
}

async function activeHealthEnrollments(
  database: Context["db"],
  { id, today }: { id: string; today: Date },
): Promise<HealthEnrollment[]> {
  return database.enrollment.findMany({
    where: {
      studentId: id,
      deletedAt: null,
      entryDate: { lte: today },
      class: {
        deletedAt: null,
        semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      },
    },
    select: healthEnrollmentSelect(today),
  });
}

function healthWindows(enrollments: HealthEnrollment[]): HealthWindow[] {
  return enrollments.flatMap((enrollment) => {
    const window = intersectEnrollmentSemesterWindows({
      enrollment,
      semester: enrollment.class.semester,
    });
    return window
      ? [{ classId: enrollment.classId, exitDate: enrollment.exitDate, ...window }]
      : [];
  });
}

async function healthOccurrences(
  database: Context["db"],
  { id, today, windows }: { id: string; today: Date; windows: HealthWindow[] },
): Promise<HealthOccurrence[]> {
  if (windows.length === 0) return [];
  return database.pedagogicalOccurrence.findMany({
    where: {
      studentId: id,
      deletedAt: null,
      classSession: {
        deletedAt: null,
        OR: windows.map((window) => ({
          classId: window.classId,
          date: {
            gte: window.startDate,
            lte: new Date(Math.min(window.endDate.getTime(), today.getTime())),
            ...(window.exitDate ? { lt: window.exitDate } : {}),
          },
        })),
      },
    },
    select: {
      interventions: {
        where: {
          deletedAt: null,
          intervention: { studentId: id, deletedAt: null, performedOn: { lte: today } },
        },
        select: { interventionId: true },
      },
    },
  });
}

function healthGrades(enrollments: HealthEnrollment[]): number[] {
  // A transfer can link the same assessment to multiple enrollments. Count each grade once,
  // retaining completed stages from this semester and excluding grades from earlier periods.
  const gradesById = new Map<string, number>();
  for (const enrollment of enrollments) {
    for (const { assessment } of enrollment.progressRecords) {
      if (!assessment || assessment.deletedAt) continue;
      for (const grade of assessment.grades) {
        if (grade.assessedOn >= enrollment.class.semester.startDate) {
          gradesById.set(grade.id, Number(grade.score));
        }
      }
    }
  }
  return [...gradesById.values()];
}
