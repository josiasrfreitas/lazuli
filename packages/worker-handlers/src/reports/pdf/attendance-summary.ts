/**
 * Attendance summary PDF data loading (§7.2, §4.6). Semester defaults to the
 * one covering the injected `now` (SETUP_ERROR_NO_ACTIVE_SEMESTER when none).
 * Any session in an enrollment window that maps to no/multiple semesters
 * fails the artifact (SETUP_ERROR_UNBUCKETED_SESSION) — never silently
 * omitted. Makeups are reported separately and never affect the percentage.
 */

import type { Prisma } from "@lazuli/db";
import {
  computeAttendancePercent,
  deriveMakeupDisplayStatus,
  resolveSemesterForDate,
  SemesterBucketError,
  type SemesterWindow,
} from "@lazuli/domain";

import { ReportGenerationError } from "../report-error.js";
import type { AttendanceSummaryTemplateData } from "../templates/attendance-summary.template.js";
import { formatInstantPtBr, formatPercentPtBr } from "../templates/format.js";
import { saoPauloNowAsUtcDate } from "./class-roster.js";

type AttendanceSummaryDatabase = Pick<
  Prisma.TransactionClient,
  "student" | "semester" | "enrollment"
>;

export async function loadAttendanceSummaryTemplateData(input: {
  database: AttendanceSummaryDatabase;
  studentId: string;
  now: Date;
}): Promise<AttendanceSummaryTemplateData> {
  const student = await loadStudent(input);
  const semesters = await loadSemesters(input.database);
  const activeSemester = resolveActiveSemester({ semesters, now: input.now });
  const enrollments = await loadEnrollments(input);

  return {
    generatedAt: formatInstantPtBr(input.now),
    studentName: student.fullName,
    semesterName: activeSemester.name,
    enrollments: enrollments
      .filter((enrollment) => overlapsSemester(enrollment, activeSemester))
      .map((enrollment) =>
        summarizeEnrollment({ enrollment, semesters, semester: activeSemester, now: input.now }),
      ),
  };
}

async function loadStudent(input: {
  database: AttendanceSummaryDatabase;
  studentId: string;
}): Promise<{ fullName: string }> {
  const student = await input.database.student.findFirst({
    where: { id: input.studentId, deletedAt: null },
    select: { fullName: true },
  });

  if (student === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_STUDENT_NOT_FOUND",
      message: `Aluno ${input.studentId} não encontrado.`,
    });
  }

  return student;
}

function loadSemesters(database: AttendanceSummaryDatabase): Promise<SemesterWindow[]> {
  return database.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

function resolveActiveSemester(input: {
  semesters: readonly SemesterWindow[];
  now: Date;
}): SemesterWindow {
  try {
    return resolveSemesterForDate(saoPauloNowAsUtcDate(input.now), input.semesters);
  } catch (error) {
    if (error instanceof SemesterBucketError) {
      throw new ReportGenerationError({
        code: "SETUP_ERROR_NO_ACTIVE_SEMESTER",
        message: "Nenhum semestre ativo cobre a data de geração do resumo de frequência.",
      });
    }

    throw error;
  }
}

type LoadedEnrollment = {
  id: string;
  entryDate: Date;
  exitDate: Date | null;
  class: {
    internalCode: string;
    sessions: {
      date: Date;
      endTime: Date;
      status: string;
      attendanceConfirmedAt: Date | null;
      attendanceRows: { enrollmentId: string; status: string }[];
    }[];
  };
  makeups: {
    cancelledAt: Date | null;
    attendedAt: Date | null;
    targetClassSession: { date: Date; endTime: Date; status: string };
  }[];
};

function loadEnrollments(input: {
  database: AttendanceSummaryDatabase;
  studentId: string;
}): Promise<LoadedEnrollment[]> {
  return input.database.enrollment.findMany({
    where: { studentId: input.studentId, deletedAt: null },
    select: {
      id: true,
      entryDate: true,
      exitDate: true,
      class: {
        select: {
          internalCode: true,
          sessions: {
            where: { deletedAt: null },
            select: {
              date: true,
              endTime: true,
              status: true,
              attendanceConfirmedAt: true,
              attendanceRows: {
                where: { deletedAt: null },
                select: { enrollmentId: true, status: true },
              },
            },
          },
        },
      },
      makeups: {
        where: { deletedAt: null },
        select: {
          cancelledAt: true,
          attendedAt: true,
          targetClassSession: { select: { date: true, endTime: true, status: true } },
        },
      },
    },
    orderBy: { entryDate: "asc" },
  });
}

function overlapsSemester(enrollment: LoadedEnrollment, semester: SemesterWindow): boolean {
  const exitsBeforeSemester =
    enrollment.exitDate !== null && enrollment.exitDate < semester.startDate;

  return enrollment.entryDate <= semester.endDate && !exitsBeforeSemester;
}

function summarizeEnrollment(input: {
  enrollment: LoadedEnrollment;
  semesters: readonly SemesterWindow[];
  semester: SemesterWindow;
  now: Date;
}): AttendanceSummaryTemplateData["enrollments"][number] {
  const windowSessions = sessionsInEnrollmentWindow(input.enrollment);
  assertSessionsBucketed({
    enrollment: input.enrollment,
    sessions: windowSessions,
    semesters: input.semesters,
  });

  const heldSessions = windowSessions.filter(
    (session) =>
      isInSemester(session.date, input.semester) &&
      session.status !== "CANCELLED" &&
      session.attendanceConfirmedAt !== null,
  );
  const presentCount = heldSessions.filter((session) =>
    session.attendanceRows.some(
      (row) => row.enrollmentId === input.enrollment.id && row.status === "PRESENT",
    ),
  ).length;
  const percent = computeAttendancePercent({ heldSessions: heldSessions.length, presentCount });
  const makeups = summarizeMakeups(input);

  return {
    classCode: input.enrollment.class.internalCode,
    heldSessions: percent.heldSessions,
    presentCount: percent.presentCount,
    absentCount: percent.heldSessions - percent.presentCount,
    percentLabel: formatPercentPtBr(percent.percent),
    flagged: percent.flagged,
    makeupsAttended: makeups.attended,
    makeupsTotal: makeups.total,
  };
}

function sessionsInEnrollmentWindow(
  enrollment: LoadedEnrollment,
): LoadedEnrollment["class"]["sessions"] {
  return enrollment.class.sessions.filter(
    (session) =>
      session.date >= enrollment.entryDate &&
      (enrollment.exitDate === null || session.date <= enrollment.exitDate),
  );
}

function assertSessionsBucketed(input: {
  enrollment: LoadedEnrollment;
  sessions: LoadedEnrollment["class"]["sessions"];
  semesters: readonly SemesterWindow[];
}): void {
  for (const session of input.sessions) {
    try {
      resolveSemesterForDate(session.date, input.semesters);
    } catch (error) {
      if (error instanceof SemesterBucketError) {
        throw new ReportGenerationError({
          code: "SETUP_ERROR_UNBUCKETED_SESSION",
          message: `Sessão sem semestre único na janela da matrícula ${input.enrollment.id}.`,
        });
      }

      throw error;
    }
  }
}

function isInSemester(date: Date, semester: SemesterWindow): boolean {
  return date >= semester.startDate && date <= semester.endDate;
}

function summarizeMakeups(input: {
  enrollment: LoadedEnrollment;
  semester: SemesterWindow;
  now: Date;
}): { attended: number; total: number } {
  const inSemester = input.enrollment.makeups.filter((makeup) =>
    isInSemester(makeup.targetClassSession.date, input.semester),
  );
  const statuses = inSemester.map((makeup) =>
    deriveMakeupDisplayStatus({
      cancelledAt: makeup.cancelledAt,
      targetSessionCancelled: makeup.targetClassSession.status === "CANCELLED",
      attendedAt: makeup.attendedAt,
      targetSessionDate: makeup.targetClassSession.date,
      targetSessionEndTime: makeup.targetClassSession.endTime,
      now: input.now,
    }),
  );

  return {
    attended: statuses.filter((status) => status === "ATTENDED").length,
    total: statuses.filter((status) => status !== "CANCELLED").length,
  };
}
