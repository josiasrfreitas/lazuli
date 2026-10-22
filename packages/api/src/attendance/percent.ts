import {
  computeCompensatedAttendance,
  teachingMinutes,
  saoPauloDateOnly,
  intersectEnrollmentSemesterWindows,
  type AttendanceProgress,
} from "@lazuli/domain";
import type { attendanceEnrollmentSemesterPercentInputSchema, z } from "@lazuli/validators";

import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import type { StaffUser } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { assertResourceScope } from "../trpc/rbac.js";
import type { AttendanceDatabase } from "./data.js";
import { ENROLLMENT_NOT_FOUND_MESSAGE, SEMESTER_NOT_FOUND_MESSAGE } from "./errors.js";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

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

/** Confirmed home lessons define the denominator; completed source-linked compensation adds minutes. */
export async function computeEnrollmentPercentInWindow(input: {
  database: AttendanceDatabase;
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
  const semester = await input.database.semester.findFirst({
    where: { id: input.semesterId, deletedAt: null },
    select: { id: true, startDate: true, endDate: true },
  });

  if (semester === null) {
    throw notFound(SEMESTER_NOT_FOUND_MESSAGE);
  }

  return semester;
}
