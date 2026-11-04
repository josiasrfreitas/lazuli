import { saoPauloDateOnly } from "@lazuli/domain";
import type { Prisma } from "./generated/prisma/client.js";
import {
  healthEnrollmentSelect,
  healthWindows,
  summarizeHealth,
  type HealthResult,
} from "./student-health.js";
import { readHealthAttendanceBatch } from "./student-health-batch-attendance.js";

/** A page shares enrollment, session and occurrence reads; calculations remain per student. */
export async function readStudentHealthBatch(input: {
  database: Pick<
    Prisma.TransactionClient,
    "student" | "enrollment" | "classSession" | "pedagogicalOccurrence"
  >;
  ids: string[];
  now: Date;
}): Promise<Array<HealthResult & { studentId: string }>> {
  const today = new Date(saoPauloDateOnly(input.now));
  const students = await input.database.student.findMany({
    where: { id: { in: input.ids }, deletedAt: null },
    select: { id: true },
  });
  if (students.length === 0) return [];
  const enrollments = await input.database.enrollment.findMany({
    where: {
      studentId: { in: students.map((student) => student.id) },
      deletedAt: null,
      entryDate: { lte: today },
      class: {
        deletedAt: null,
        semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      },
    },
    select: { ...healthEnrollmentSelect(today), studentId: true },
  });
  const [attendance, occurrences] = await Promise.all([
    readHealthAttendanceBatch({ database: input.database, enrollments, today }),
    readOccurrences({ database: input.database, enrollments, today }),
  ]);
  return students.map(({ id }) => ({
    studentId: id,
    ...summarizeHealth({
      enrollments: enrollments.filter((row) => row.studentId === id),
      attendance: attendance.filter((row) => row.studentId === id),
      occurrences: occurrences
        .filter((row) => row.studentId === id)
        .map((row) => ({
          interventions: row.interventions.filter((link) => link.intervention.studentId === id),
        })),
      now: input.now,
    }),
  }));
}

type BatchEnrollment = import("./student-health.js").HealthEnrollment & { studentId: string };
type HealthOccurrence = {
  studentId: string;
  interventions: Array<{ interventionId: string; intervention: { studentId: string } }>;
};
async function readOccurrences(input: {
  database: Pick<Prisma.TransactionClient, "pedagogicalOccurrence">;
  enrollments: BatchEnrollment[];
  today: Date;
}): Promise<HealthOccurrence[]> {
  const windows = input.enrollments.flatMap((enrollment) =>
    healthWindows([enrollment]).map((window) => ({
      studentId: enrollment.studentId,
      classSession: {
        deletedAt: null,
        classId: window.classId,
        date: {
          gte: window.startDate,
          lte: new Date(Math.min(window.endDate.getTime(), input.today.getTime())),
          ...(window.exitDate ? { lt: window.exitDate } : {}),
        },
      },
    })),
  );
  if (windows.length === 0) return [];
  return input.database.pedagogicalOccurrence.findMany({
    where: { deletedAt: null, OR: windows },
    select: {
      studentId: true,
      interventions: {
        where: {
          deletedAt: null,
          intervention: { deletedAt: null, performedOn: { lte: input.today } },
        },
        select: { interventionId: true, intervention: { select: { studentId: true } } },
      },
    },
  });
}
