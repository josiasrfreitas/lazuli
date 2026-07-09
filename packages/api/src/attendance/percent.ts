import { computeAttendancePercent, type AttendancePercent } from "@lazuli/domain";
import type { attendanceEnrollmentSemesterPercentInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import type { AttendanceDatabase } from "./data.js";
import { ENROLLMENT_NOT_FOUND_MESSAGE, SEMESTER_NOT_FOUND_MESSAGE, notFound } from "./errors.js";

type PercentInput = z.infer<typeof attendanceEnrollmentSemesterPercentInputSchema>;

type EnrollmentForPercent = {
  id: string;
  classId: string;
  entryDate: Date;
  exitDate: Date | null;
  class: { teacherId: string };
};

type SemesterForPercent = {
  id: string;
  startDate: Date;
  endDate: Date;
};

export type EnrollmentSemesterPercentResult = AttendancePercent & {
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
  const window = intersectWindows({ enrollment, semester });

  if (window === null) {
    return {
      enrollmentId: enrollment.id,
      semesterId: semester.id,
      ...computeAttendancePercent({ heldSessions: 0, presentCount: 0 }),
    };
  }

  const heldSessions = await countHeldSessions({
    database: input.database,
    classId: enrollment.classId,
    startDate: window.startDate,
    endDate: window.endDate,
  });
  const presentCount = await countPresentRows({
    database: input.database,
    enrollmentId: enrollment.id,
    classId: enrollment.classId,
    startDate: window.startDate,
    endDate: window.endDate,
  });

  return {
    enrollmentId: enrollment.id,
    semesterId: semester.id,
    ...computeAttendancePercent({ heldSessions, presentCount }),
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
      class: { select: { teacherId: true } },
    },
  });

  if (enrollment === null) {
    throw notFound(ENROLLMENT_NOT_FOUND_MESSAGE);
  }

  return enrollment;
}

async function loadSemester(input: {
  database: AttendanceDatabase;
  semesterId: string;
}): Promise<SemesterForPercent> {
  const semester = await input.database.semester.findFirst({
    where: { id: input.semesterId, deletedAt: null },
    select: { id: true, startDate: true, endDate: true },
  });

  if (semester === null) {
    throw notFound(SEMESTER_NOT_FOUND_MESSAGE);
  }

  return semester;
}

function intersectWindows(input: {
  enrollment: EnrollmentForPercent;
  semester: SemesterForPercent;
}): { startDate: Date; endDate: Date } | null {
  const startDate = latest(input.enrollment.entryDate, input.semester.startDate);
  const endDate = earliest(
    input.enrollment.exitDate ?? input.semester.endDate,
    input.semester.endDate,
  );

  if (startDate > endDate) {
    return null;
  }

  return { startDate, endDate };
}

async function countHeldSessions(input: {
  database: AttendanceDatabase;
  classId: string;
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  return input.database.classSession.count({
    where: {
      classId: input.classId,
      deletedAt: null,
      status: "SCHEDULED",
      attendanceConfirmedAt: { not: null },
      date: { gte: input.startDate, lte: input.endDate },
    },
  });
}

async function countPresentRows(input: {
  database: AttendanceDatabase;
  enrollmentId: string;
  classId: string;
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  return input.database.attendance.count({
    where: {
      enrollmentId: input.enrollmentId,
      deletedAt: null,
      status: "PRESENT",
      classSession: {
        classId: input.classId,
        deletedAt: null,
        status: "SCHEDULED",
        attendanceConfirmedAt: { not: null },
        date: { gte: input.startDate, lte: input.endDate },
      },
    },
  });
}

function latest(left: Date, right: Date): Date {
  return left > right ? left : right;
}

function earliest(left: Date, right: Date): Date {
  return left < right ? left : right;
}
