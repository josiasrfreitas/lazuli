/**
 * Class roster PDF data loading (§7.2). The roster date defaults to the
 * injected `now` (America/Sao_Paulo); the semester shown is the class's own
 * semester or, failing that, the semester covering `now`.
 */

import type { Prisma } from "@lazuli/db";
import { resolveSemesterForDate, SemesterBucketError, saoPauloDateOnly } from "@lazuli/domain";

import { ReportGenerationError } from "../report-error.js";
import type { ClassRosterTemplateData } from "../templates/class-roster.template.js";
import { formatDateOnlyPtBr, formatInstantPtBr } from "../templates/format.js";
import { weekdayLabel } from "../templates/labels.js";

const TIME_START_INDEX = 11;
const TIME_ONLY_LENGTH = 5;

type ClassRosterDatabase = Pick<Prisma.TransactionClient, "class" | "semester" | "enrollment">;

export async function loadClassRosterTemplateData(input: {
  database: ClassRosterDatabase;
  classId: string;
  now: Date;
}): Promise<ClassRosterTemplateData> {
  const classRow = await loadClassRow(input);
  const semesterName = await resolveSemesterName(input, classRow.semester);
  const students = await loadActiveEnrollments(input);

  return {
    generatedAt: formatInstantPtBr(input.now),
    classCode: classRow.internalCode,
    teacherName: classRow.teacher.name,
    semesterName,
    scheduleLines: buildScheduleLines(classRow.scheduleSlots),
    students,
  };
}

type LoadedClassRow = {
  internalCode: string;
  teacher: { name: string };
  semester: { name: string } | null;
  scheduleSlots: { weekday: string; startTime: Date; endTime: Date }[];
};

async function loadClassRow(input: {
  database: ClassRosterDatabase;
  classId: string;
}): Promise<LoadedClassRow> {
  const classRow = await input.database.class.findFirst({
    where: { id: input.classId, deletedAt: null },
    select: {
      internalCode: true,
      teacher: { select: { name: true } },
      semester: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
        // Postgres enums order by declaration, so weekday asc = Monday first.
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (classRow === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_CLASS_NOT_FOUND",
      message: `Turma ${input.classId} não encontrada.`,
    });
  }

  return classRow;
}

async function resolveSemesterName(
  input: { database: ClassRosterDatabase; now: Date },
  classSemester: { name: string } | null,
): Promise<string> {
  if (classSemester !== null) {
    return classSemester.name;
  }

  const semesters = await input.database.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  try {
    return resolveSemesterForDate(saoPauloNowAsUtcDate(input.now), semesters).name;
  } catch (error) {
    if (error instanceof SemesterBucketError) {
      throw new ReportGenerationError({
        code: "SETUP_ERROR_NO_ACTIVE_SEMESTER",
        message: "Nenhum semestre ativo cobre a data de geração da lista de turma.",
      });
    }

    throw error;
  }
}

async function loadActiveEnrollments(input: {
  database: ClassRosterDatabase;
  classId: string;
  now: Date;
}): Promise<{ fullName: string; entryDate: string }[]> {
  const today = saoPauloNowAsUtcDate(input.now);
  const enrollments = await input.database.enrollment.findMany({
    where: {
      classId: input.classId,
      deletedAt: null,
      entryDate: { lte: today },
      OR: [{ exitDate: null }, { exitDate: { gte: today } }],
    },
    select: {
      entryDate: true,
      student: { select: { fullName: true } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    fullName: enrollment.student.fullName,
    entryDate: formatDateOnlyPtBr(enrollment.entryDate),
  }));
}

function buildScheduleLines(
  slots: readonly { weekday: string; startTime: Date; endTime: Date }[],
): string[] {
  return slots.map(
    (slot) => `${weekdayLabel(slot.weekday)} ${timeOnly(slot.startTime)}–${timeOnly(slot.endTime)}`,
  );
}

function timeOnly(value: Date): string {
  return value.toISOString().slice(TIME_START_INDEX, TIME_START_INDEX + TIME_ONLY_LENGTH);
}

/** The America/Sao_Paulo calendar day of `now`, as a UTC-midnight `Date` for `@db.Date` compares. */
export function saoPauloNowAsUtcDate(now: Date): Date {
  return new Date(`${saoPauloDateOnly(now)}T00:00:00.000Z`);
}
