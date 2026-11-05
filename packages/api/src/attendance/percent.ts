import { saoPauloDateOnly, type AttendanceProgress } from "@lazuli/domain";
import type { attendanceEnrollmentSemesterPercentInputSchema, z } from "@lazuli/validators";

import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import type { StaffUser } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { assertResourceScope } from "../trpc/rbac.js";
import type { AttendanceDatabase } from "./data.js";
import { ENROLLMENT_NOT_FOUND_MESSAGE, SEMESTER_NOT_FOUND_MESSAGE } from "./errors.js";

const DB_MODULE = "@lazuli/db";
type DbModule = typeof import("@lazuli/db");

export async function computeEnrollmentPercentInWindow(
  input: Parameters<DbModule["computeEnrollmentPercentInWindow"]>[0],
): Promise<Awaited<ReturnType<DbModule["computeEnrollmentPercentInWindow"]>>> {
  const databaseModule = (await import(DB_MODULE)) as DbModule;
  return databaseModule.computeEnrollmentPercentInWindow(input);
}

export async function computeEnrollmentsPercentInWindow(
  input: Parameters<DbModule["computeEnrollmentsPercentInWindow"]>[0],
): Promise<Map<string, AttendanceProgress>> {
  const databaseModule = (await import(DB_MODULE)) as DbModule;
  return databaseModule.computeEnrollmentsPercentInWindow(input);
}

type PercentInput = z.infer<typeof attendanceEnrollmentSemesterPercentInputSchema>;

/** The enrollment facts the percent window needs; `class` is only used for RBAC scoping. */
export type EnrollmentWindow = {
  id: string;
  classId: string;
  entryDate: Date;
  exitDate: Date | null;
};

type EnrollmentForPercent = EnrollmentWindow & {
  class: { teacherId: string | null };
};

export type SemesterWindowDates = {
  startDate: Date;
  endDate: Date;
};

type SemesterForPercent = SemesterWindowDates & {
  id: string;
};

export type EnrollmentSemesterPercentResult = AttendanceProgress & {
  enrollmentId: string;
  semesterId: string;
};

export async function readEnrollmentSemesterPercent(input: {
  database: AttendanceDatabase;
  staffUser: StaffUser;
  values: PercentInput;
}): Promise<EnrollmentSemesterPercentResult> {
  const enrollment = await loadEnrollment({
    database: input.database,
    enrollmentId: input.values.enrollmentId,
  });
  assertResourceScope(input.staffUser, { teacherId: enrollment.class.teacherId });

  const semester = await loadSemester({
    database: input.database,
    semesterId: input.values.semesterId,
  });

  return {
    enrollmentId: enrollment.id,
    semesterId: semester.id,
    ...(await computeEnrollmentPercentInWindow({
      database: input.database,
      values: { enrollment, semester },
    })),
  };
}

async function loadEnrollment(input: {
  database: AttendanceDatabase;
  enrollmentId: string;
}): Promise<EnrollmentForPercent> {
  const enrollment = await input.database.enrollment.findFirst({
    where: { id: input.enrollmentId, deletedAt: null },
    select: {
      id: true,
      classId: true,
      entryDate: true,
      exitDate: true,
      class: { select: responsibilitySelect },
    },
  });

  if (enrollment === null) {
    throw notFound(ENROLLMENT_NOT_FOUND_MESSAGE);
  }

  return {
    ...enrollment,
    class: {
      teacherId:
        usualTeacherOn(enrollment.class, new Date(saoPauloDateOnly(new Date())))?.id ?? null,
    },
  };
}

async function loadSemester(input: {
  database: AttendanceDatabase;
  semesterId: string;
}): Promise<SemesterForPercent> {
  const semester = await input.database.period.findFirst({
    where: { id: input.semesterId, deletedAt: null },
    select: { id: true, startDate: true, endDate: true },
  });

  if (semester === null) {
    throw notFound(SEMESTER_NOT_FOUND_MESSAGE);
  }

  return semester;
}
