import type { Prisma } from "@lazuli/db";
import {
  computeCompensatedAttendance,
  intersectEnrollmentSemesterWindows,
  saoPauloDateOnly,
  teachingMinutes,
  type AttendanceProgress,
} from "@lazuli/domain";
import type { Context } from "../trpc/context.js";
import { notFound } from "../trpc/errors.js";
import { ENROLLMENT_NOT_FOUND_MESSAGE } from "../attendance/errors.js";
import { STUDENT_NOT_FOUND_MESSAGE } from "./errors.js";
import { toDateOnlyString } from "./date-rules.js";

type AttendanceFilter = "ALL" | "PRESENT" | "ABSENT" | "PENDING" | "CANCELLED";
type Input = {
  database: Context["db"];
  id: string;
  enrollmentId?: string | undefined;
  status: AttendanceFilter;
  page: number;
  now: Date;
};
const PAGE_SIZE = 25;
const TIME_START = 11;
const TIME_END = 16;
const enrollmentSelect = {
  id: true,
  classId: true,
  entryDate: true,
  exitDate: true,
  class: {
    select: {
      portalClassName: true,
      semester: { select: { name: true, startDate: true, endDate: true } },
    },
  },
} satisfies Prisma.EnrollmentSelect;
type Enrollment = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;
type HistoryWindow = { enrollment: Enrollment; startDate: Date; endDate: Date };
const sessionSelect = {
  id: true,
  classId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  cancelReason: true,
  attendanceConfirmedAt: true,
  attendanceRows: {
    where: { deletedAt: null },
    select: {
      enrollmentId: true,
      status: true,
      notes: true,
      makeupCoverages: {
        where: { deletedAt: null, appointment: { deletedAt: null, status: "ATTENDED" } },
        select: { minutes: true },
      },
    },
  },
} satisfies Prisma.ClassSessionSelect;
type Session = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;
type HistoryRow = {
  id: string;
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  semester: string;
  status: Exclude<AttendanceFilter, "ALL">;
  confirmed: boolean;
  minutes: number;
  compensatedMinutes: number;
  notes: string | null;
};
export type StudentAttendanceHistory = {
  today: string;
  enrollments: Array<{ id: string; className: string; semester: string; entryDate: string }>;
  attendance: AttendanceProgress;
  counts: Record<AttendanceFilter, number>;
  rows: HistoryRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
};

/** Preserves original calls within roster windows; cancelled and unconfirmed rows remain explainable. */
export async function readStudentAttendanceHistory(
  input: Input,
): Promise<StudentAttendanceHistory> {
  const enrollments = await loadHistoryEnrollments(input);
  const today = saoPauloDateOnly(input.now);
  const windows = enrollments
    .filter((row) => !input.enrollmentId || row.id === input.enrollmentId)
    .flatMap((enrollment) => {
      const window = historyWindow(enrollment, today);
      return window ? [{ enrollment, ...window }] : [];
    });
  const sessions = await loadHistorySessions({ database: input.database, windows });
  const rows = sessions.flatMap((session) =>
    windows
      .filter((window) => matchesHistoryWindow(session, window))
      .map(({ enrollment }) => historyRow(session, enrollment)),
  );
  return {
    today,
    enrollments: enrollments.map((row) => ({
      id: row.id,
      className: row.class.portalClassName,
      semester: row.class.semester.name,
      entryDate: toDateOnlyString(row.entryDate),
    })),
    ...historyResult(rows, input),
  };
}
async function loadHistoryEnrollments(input: Input): Promise<Enrollment[]> {
  const student = await input.database.student.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const enrollments = await input.database.enrollment.findMany({
    where: { studentId: input.id, deletedAt: null, class: { deletedAt: null } },
    orderBy: [{ entryDate: "desc" }, { id: "asc" }],
    select: enrollmentSelect,
  });
  if (input.enrollmentId && !enrollments.some((row) => row.id === input.enrollmentId))
    throw notFound(ENROLLMENT_NOT_FOUND_MESSAGE);
  return enrollments;
}
async function loadHistorySessions({
  database,
  windows,
}: {
  database: Context["db"];
  windows: HistoryWindow[];
}): Promise<Session[]> {
  if (windows.length === 0) return [];
  return database.classSession.findMany({
    where: {
      deletedAt: null,
      OR: windows.map(({ enrollment, startDate, endDate }) => ({
        classId: enrollment.classId,
        date: {
          gte: startDate,
          lte: endDate,
          ...(enrollment.exitDate ? { lt: enrollment.exitDate } : {}),
        },
      })),
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "asc" }],
    select: {
      ...sessionSelect,
      attendanceRows: {
        ...sessionSelect.attendanceRows,
        where: { enrollmentId: { in: windows.map((row) => row.enrollment.id) }, deletedAt: null },
      },
    },
  });
}
function matchesHistoryWindow(
  session: Session,
  { enrollment, startDate, endDate }: HistoryWindow,
): boolean {
  return (
    session.classId === enrollment.classId &&
    session.date >= startDate &&
    session.date <= endDate &&
    (!enrollment.exitDate || session.date < enrollment.exitDate)
  );
}
function historyRow(session: Session, enrollment: Enrollment): HistoryRow {
  const attendance = session.attendanceRows.find((row) => row.enrollmentId === enrollment.id);
  const confirmed = session.status === "SCHEDULED" && session.attendanceConfirmedAt !== null;
  const status = historyStatus(session, { attendance, confirmed });
  const startTime = session.startTime.toISOString().slice(TIME_START, TIME_END);
  const endTime = session.endTime.toISOString().slice(TIME_START, TIME_END);
  const minutes = teachingMinutes({ startTime, endTime });
  return {
    id: `${enrollment.id}:${session.id}`,
    sessionId: session.id,
    date: toDateOnlyString(session.date),
    startTime,
    endTime,
    className: enrollment.class.portalClassName,
    semester: enrollment.class.semester.name,
    status,
    confirmed,
    minutes,
    compensatedMinutes:
      status === "ABSENT"
        ? Math.min(
            minutes,
            attendance?.makeupCoverages.reduce((sum, row) => sum + row.minutes, 0) ?? 0,
          )
        : 0,
    notes: historyNotes(session, { attendance, confirmed }),
  };
}
type RowState = { attendance: Session["attendanceRows"][number] | undefined; confirmed: boolean };
function historyStatus(
  session: Session,
  { attendance, confirmed }: RowState,
): HistoryRow["status"] {
  if (session.status === "CANCELLED") return "CANCELLED";
  return confirmed && attendance ? attendance.status : "PENDING";
}
function historyNotes(session: Session, { attendance, confirmed }: RowState): string | null {
  if (session.status === "CANCELLED") return session.cancelReason;
  return confirmed ? (attendance?.notes ?? null) : null;
}
function historyResult(
  rows: HistoryRow[],
  input: Pick<Input, "status" | "page">,
): Pick<
  StudentAttendanceHistory,
  "attendance" | "counts" | "rows" | "page" | "pageSize" | "pageCount" | "totalItems"
> {
  const attendance = computeCompensatedAttendance(
    rows
      .filter((row) => row.confirmed)
      .map((row) => ({
        minutes: row.minutes,
        status: row.status === "PRESENT" || row.status === "ABSENT" ? row.status : null,
        compensatedMinutes: row.compensatedMinutes,
      })),
  );
  const counts = {
    ALL: rows.length,
    PRESENT: rows.filter((row) => row.status === "PRESENT").length,
    ABSENT: rows.filter((row) => row.status === "ABSENT").length,
    PENDING: rows.filter((row) => row.status === "PENDING").length,
    CANCELLED: rows.filter((row) => row.status === "CANCELLED").length,
  };
  const filtered = rows.filter((row) => input.status === "ALL" || row.status === input.status);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(input.page, pageCount);
  return {
    attendance,
    counts,
    rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    totalItems: filtered.length,
  };
}
function historyWindow(
  enrollment: Enrollment,
  today: string,
): { startDate: Date; endDate: Date } | null {
  const window = intersectEnrollmentSemesterWindows({
    enrollment,
    semester: enrollment.class.semester,
  });
  if (!window) return null;
  const endDate = new Date(Math.min(window.endDate.getTime(), new Date(today).getTime()));
  return window.startDate <= endDate ? { startDate: window.startDate, endDate } : null;
}
