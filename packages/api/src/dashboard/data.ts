import { isSessionUntaken, saoPauloDateOnly, saoPauloMonthInstantBounds } from "@lazuli/domain";

import type { Context, StaffUser } from "../trpc/context.js";

type Database = Context["db"];

const DATE_ONLY_END_INDEX = 10;
const TIME_ONLY_START_INDEX = 11;
const TIME_ONLY_END_INDEX = 16;
const YEAR_START_INDEX = 0;

type ClassSessionRow = {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  attendanceConfirmedAt: Date | null;
  class: {
    id: string;
    internalCode: string;
    portalClassName: string;
  };
};

export type DashboardSessionSummary = {
  sessionId: string;
  classId: string;
  classInternalCode: string;
  portalClassName: string;
  date: string;
  startTime: string;
  endTime: string;
  attendanceConfirmedAt: Date | null;
};

export type AdminDashboardMetrics = {
  activeStudents: {
    total: number;
    newThisMonth: number;
  };
  operationalWarnings: {
    totalUntakenSessions: number;
    untakenSessions: DashboardSessionSummary[];
  };
};

export type TeacherHome = {
  today: string;
  todaySessions: DashboardSessionSummary[];
  nextSessionsByClass: Array<{
    classId: string;
    classInternalCode: string;
    portalClassName: string;
    nextSession: DashboardSessionSummary | null;
  }>;
};

export async function readAdminDashboardMetrics(input: {
  database: Database;
  now: Date;
}): Promise<AdminDashboardMetrics> {
  const { startInstant, endExclusiveInstant } = saoPauloMonthInstantBounds(input.now);
  const today = dateOnlyToDate(saoPauloDateOnly(input.now));
  const [totalActiveStudents, newThisMonth, untakenCandidates] = await Promise.all([
    input.database.student.count({ where: { status: "ACTIVE" } }),
    input.database.student.count({
      where: {
        status: "ACTIVE",
        createdAt: {
          gte: startInstant,
          lt: endExclusiveInstant,
        },
      },
    }),
    input.database.classSession.findMany({
      where: {
        status: "SCHEDULED",
        attendanceConfirmedAt: null,
        date: { lte: today },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
      select: sessionSummarySelect(),
    }),
  ]);

  const untakenSessions = untakenCandidates
    .filter((session) =>
      isSessionUntaken({
        status: "SCHEDULED",
        date: session.date,
        endTime: session.endTime,
        attendanceConfirmedAt: session.attendanceConfirmedAt,
        now: input.now,
      }),
    )
    .map((session) => toSessionSummary(session));

  return {
    activeStudents: {
      total: totalActiveStudents,
      newThisMonth,
    },
    operationalWarnings: {
      totalUntakenSessions: untakenSessions.length,
      untakenSessions,
    },
  };
}

export async function readTeacherHome(input: {
  database: Database;
  staffUser: StaffUser;
  now: Date;
}): Promise<TeacherHome> {
  const today = saoPauloDateOnly(input.now);
  const todayDate = dateOnlyToDate(today);
  const [todaySessions, classes] = await Promise.all([
    findTeacherTodaySessions({
      database: input.database,
      teacherId: input.staffUser.id,
      todayDate,
    }),
    findTeacherClassesWithNextSession({
      database: input.database,
      teacherId: input.staffUser.id,
      todayDate,
    }),
  ]);

  return {
    today,
    todaySessions: todaySessions.map((session) => toSessionSummary(session)),
    nextSessionsByClass: classes.map((classRow) => ({
      classId: classRow.id,
      classInternalCode: classRow.internalCode,
      portalClassName: classRow.portalClassName,
      nextSession:
        classRow.sessions[0] === undefined ? null : toSessionSummary(classRow.sessions[0]),
    })),
  };
}

function findTeacherTodaySessions(input: {
  database: Database;
  teacherId: string;
  todayDate: Date;
}): Promise<ClassSessionRow[]> {
  return input.database.classSession.findMany({
    where: {
      date: input.todayDate,
      status: "SCHEDULED",
      class: {
        teacherId: input.teacherId,
        status: "ACTIVE",
      },
    },
    orderBy: [{ startTime: "asc" }, { class: { internalCode: "asc" } }],
    select: sessionSummarySelect(),
  });
}

function findTeacherClassesWithNextSession(input: {
  database: Database;
  teacherId: string;
  todayDate: Date;
}): Promise<
  Array<{
    id: string;
    internalCode: string;
    portalClassName: string;
    sessions: ClassSessionRow[];
  }>
> {
  return input.database.class.findMany({
    where: {
      teacherId: input.teacherId,
      status: "ACTIVE",
    },
    orderBy: { internalCode: "asc" },
    select: {
      id: true,
      internalCode: true,
      portalClassName: true,
      sessions: {
        where: {
          status: "SCHEDULED",
          date: { gte: input.todayDate },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 1,
        select: sessionSummarySelect(),
      },
    },
  });
}

function sessionSummarySelect(): {
  id: true;
  date: true;
  startTime: true;
  endTime: true;
  attendanceConfirmedAt: true;
  class: { select: { id: true; internalCode: true; portalClassName: true } };
} {
  return {
    id: true,
    date: true,
    startTime: true,
    endTime: true,
    attendanceConfirmedAt: true,
    class: { select: { id: true, internalCode: true, portalClassName: true } },
  };
}

function toSessionSummary(session: ClassSessionRow): DashboardSessionSummary {
  return {
    sessionId: session.id,
    classId: session.class.id,
    classInternalCode: session.class.internalCode,
    portalClassName: session.class.portalClassName,
    date: dateOnly(session.date),
    startTime: timeOnly(session.startTime),
    endTime: timeOnly(session.endTime),
    attendanceConfirmedAt: session.attendanceConfirmedAt,
  };
}

function dateOnlyToDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(YEAR_START_INDEX, DATE_ONLY_END_INDEX);
}

function timeOnly(date: Date): string {
  return date.toISOString().slice(TIME_ONLY_START_INDEX, TIME_ONLY_END_INDEX);
}
