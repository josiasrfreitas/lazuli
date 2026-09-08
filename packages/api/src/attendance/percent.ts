import {
  computeAttendancePercent,
  intersectEnrollmentSemesterWindows,
  type AttendancePercent,
} from "@lazuli/domain";
import type { attendanceEnrollmentSemesterPercentInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import type { AttendanceDatabase } from "./data.js";
import { ENROLLMENT_NOT_FOUND_MESSAGE, SEMESTER_NOT_FOUND_MESSAGE, notFound } from "./errors.js";

type PercentInput = z.infer<typeof attendanceEnrollmentSemesterPercentInputSchema>;

/** The enrollment facts the percent window needs; `class` is only used for RBAC scoping. */
export type EnrollmentWindow = {
  id: string;
  classId: string;
  entryDate: Date;
  exitDate: Date | null;
};

type EnrollmentForPercent = EnrollmentWindow & {
  class: { teacherId: string };
};

export type SemesterWindowDates = {
  startDate: Date;
  endDate: Date;
};

type SemesterForPercent = SemesterWindowDates & {
  id: string;
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

  return {
    enrollmentId: enrollment.id,
    semesterId: semester.id,
    ...(await computeEnrollmentPercentInWindow({
      database: input.database,
      values: { enrollment, semester },
    })),
  };
}

/**
 * Attendance percent for one enrollment inside one semester window (§4.6, D-0029).
 * Shared by the per-enrollment procedure above and the students listing, so both
 * count the same facts: confirmed, non-cancelled home sessions in Semester ∩ Enrollment.
 */
export async function computeEnrollmentPercentInWindow(input: {
  database: AttendanceDatabase;
  values: { enrollment: EnrollmentWindow; semester: SemesterWindowDates };
}): Promise<AttendancePercent> {
  const window = intersectEnrollmentSemesterWindows(input.values);

  if (window === null) {
    return computeAttendancePercent({ heldSessions: 0, presentCount: 0 });
  }

  const [heldSessions, presentCount] = await Promise.all([
    countHeldSessions({
      database: input.database,
      classId: input.values.enrollment.classId,
      startDate: window.startDate,
      endDate: window.endDate,
    }),
    countPresentRows({
      database: input.database,
      enrollmentId: input.values.enrollment.id,
      classId: input.values.enrollment.classId,
      startDate: window.startDate,
      endDate: window.endDate,
    }),
  ]);

  return computeAttendancePercent({ heldSessions, presentCount });
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
