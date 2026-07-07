import type { Prisma } from "@lazuli/db";

import { SESSION_NOT_FOUND_MESSAGE, notFound } from "./errors.js";

/** Prisma delegates the attendance service touches; the router passes `ctx.db` or a transaction client. */
export type AttendanceDatabase = Pick<
  Prisma.TransactionClient,
  "classSession" | "enrollment" | "attendance" | "makeup"
>;

const sessionWithClassSelect = {
  id: true,
  classId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  attendanceConfirmedAt: true,
  attendanceConfirmedById: true,
  attendanceLastCommittedAt: true,
  class: { select: { teacherId: true } },
} satisfies Prisma.ClassSessionSelect;

export type SessionWithClass = Prisma.ClassSessionGetPayload<{
  select: typeof sessionWithClassSelect;
}>;

export type RosterEnrollment = {
  enrollmentId: string;
  studentId: string;
  studentFullName: string;
};

const rosterEnrollmentSelect = {
  id: true,
  studentId: true,
  student: { select: { fullName: true } },
} satisfies Prisma.EnrollmentSelect;

/** Loads a session with the fields both procedures need, or throws the PT-BR not-found error. */
export async function loadSessionWithClass(input: {
  database: AttendanceDatabase;
  sessionId: string;
}): Promise<SessionWithClass> {
  const session = await input.database.classSession.findUnique({
    where: { id: input.sessionId },
    select: sessionWithClassSelect,
  });

  if (session === null) {
    throw notFound(SESSION_NOT_FOUND_MESSAGE);
  }
  return session;
}

/**
 * The session roster: enrollments of the session's class whose window contains the session date
 * (`entryDate <= date <= exitDate|open`), ordered by student name. Window containment (not "currently
 * active") keeps a student who later dropped on the roster of the sessions they attended, matching the
 * attendance-percent held-sessions definition (§4.6).
 */
export async function loadActiveRoster(input: {
  database: AttendanceDatabase;
  classId: string;
  date: Date;
}): Promise<RosterEnrollment[]> {
  const enrollments = await input.database.enrollment.findMany({
    where: {
      classId: input.classId,
      entryDate: { lte: input.date },
      OR: [{ exitDate: null }, { exitDate: { gte: input.date } }],
    },
    select: rosterEnrollmentSelect,
    orderBy: { student: { fullName: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    studentFullName: enrollment.student.fullName,
  }));
}

export type SessionMakeupRow = {
  makeupId: string;
  studentId: string;
  studentFullName: string;
  originClassInternalCode: string;
  attendedAt: Date | null;
};

const sessionMakeupSelect = {
  id: true,
  attendedAt: true,
  originEnrollment: {
    select: {
      studentId: true,
      student: { select: { fullName: true } },
      class: { select: { internalCode: true } },
    },
  },
} satisfies Prisma.MakeupSelect;

/**
 * Active (non-cancelled) makeups whose target is this session — the roster "visitors" (S-ATT-2),
 * ordered by student name and carrying the origin class code shown as "turma origem". Sourced from
 * `Makeup` rows, never `Attendance`, so visitors never affect the attendance %.
 */
export async function loadSessionMakeups(input: {
  database: AttendanceDatabase;
  sessionId: string;
}): Promise<SessionMakeupRow[]> {
  const rows = await input.database.makeup.findMany({
    where: { targetClassSessionId: input.sessionId, cancelledAt: null },
    select: sessionMakeupSelect,
    orderBy: { originEnrollment: { student: { fullName: "asc" } } },
  });

  return rows.map((row) => ({
    makeupId: row.id,
    studentId: row.originEnrollment.studentId,
    studentFullName: row.originEnrollment.student.fullName,
    originClassInternalCode: row.originEnrollment.class.internalCode,
    attendedAt: row.attendedAt,
  }));
}
