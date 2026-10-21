import { sessionEndInstant, saoPauloDateOnly } from "@lazuli/domain";
import type { classRecordListSchema, z } from "@lazuli/validators";
import { classRecordSnapshotSchema } from "@lazuli/validators";
import {
  canRead,
  dateOnly,
  timeOnly,
  loadRecordSession,
  recordSessionInclude,
  responsibleTeacher,
  storedSnapshot,
  writeRestriction,
  type RecordContext,
  type RecordSession,
} from "./data.js";
import { usualTeacherOn } from "../teachers/responsibility.js";
import { initialSnapshot } from "./planned.js";
import type {
  SessionSummary,
  ClassRecordDetail,
  ClassRecordRevision,
  RevisionPage,
} from "./types.js";
import { sessionGuests, type SessionLeadGuest } from "./guests.js";
const HISTORY_PAGE_SIZE = 20;

export async function listClassRecords(
  context: RecordContext,
  input: z.infer<typeof classRecordListSchema>,
): Promise<SessionSummary[]> {
  const sessions = await context.database.classSession.findMany({
    where: {
      deletedAt: null,
      class: { deletedAt: null },
      date: { gte: new Date(input.from), lte: new Date(input.to) },
      ...(input.classId ? { classId: input.classId } : {}),
    },
    include: recordSessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  const visible = sessions.filter((session) => canRead(context, session));
  const guests = await sessionGuests(context, visible);
  return visible.map((session) =>
    summarizeSession(session, {
      now: context.now,
      leadGuests: guests.get(session.id)?.leads ?? [],
      guestCount:
        (guests.get(session.id)?.appointments.length ?? 0) +
        (guests.get(session.id)?.leads.length ?? 0),
    }),
  );
}
function recordState(session: RecordSession, now: Date): SessionSummary["state"] {
  if (session.status === "CANCELLED") return "CANCELLED";
  if (session.classRecord) return "RECORDED";
  return sessionEndInstant(session) > now ? "UPCOMING" : "PENDING";
}
function summarizeSession(
  session: RecordSession,
  {
    now,
    guestCount,
    leadGuests = [],
  }: { now: Date; guestCount: number; leadGuests?: SessionLeadGuest[] },
): SessionSummary {
  const teacher = responsibleTeacher(session);
  return {
    id: session.id,
    guestCount,
    leadGuests,
    classId: session.classId,
    className: session.class.portalClassName,
    scheduleType: session.class.scheduleType,
    format: session.class.format,
    stageName: session.class.sharedStage?.name ?? null,
    date: dateOnly(session.date),
    startTime: timeOnly(session.startTime),
    endTime: timeOnly(session.endTime),
    teacherId: teacher?.id ?? null,
    teacher: teacher?.name ?? null,
    state: recordState(session, now),
    attendanceOnly: Boolean(session.attendanceConfirmedAt && !session.classRecord),
  };
}
function usualTeacherName(session: RecordSession): string | null {
  if (!session.responsibilityFrozenAt)
    return usualTeacherOn(session.class, session.date)?.name ?? null;
  const teachers = [
    session.class.teacher,
    ...session.class.teacherAssignments.map((row) => row.teacher),
  ];
  return teachers.find((teacher) => teacher?.id === session.usualTeacherId)?.name ?? null;
}
export async function readClassRecord(
  context: RecordContext,
  sessionId: string,
): Promise<ClassRecordDetail> {
  const session = await loadRecordSession(context, sessionId);
  const attendance = await context.database.attendance.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { enrollmentId: true },
  });
  const declarations = await context.database.attendanceDeclaration.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { id: true, enrollmentId: true, submittedAt: true },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });
  const hasAttendanceWindows = Boolean(
    await context.database.attendanceWindow.count({
      where: { classSessionId: session.id, deletedAt: null },
    }),
  );
  const guestContext = (await sessionGuests(context, [session])).get(session.id);
  const guests = guestContext?.appointments ?? [];
  const summary = summarizeSession(session, {
    now: context.now,
    guestCount: guests.length + (guestContext?.leads.length ?? 0),
    leadGuests: guestContext?.leads ?? [],
  });
  return {
    guests,
    leadGuests: guestContext?.leads ?? [],
    declarations,
    hasAttendanceWindows,
    recordedAttendanceIds: attendance.map((row) => row.enrollmentId),
    session: {
      ...summary,
      cancelled: session.status === "CANCELLED",
      upcoming: sessionEndInstant(session) > context.now,
      cancelReason: session.cancelReason,
      usualTeacher: usualTeacherName(session),
    },
    version: session.classRecord?.version ?? 0,
    recordedAt: session.classRecord?.createdAt ?? null,
    attendanceStamp: session.attendanceLastCommittedAt?.toISOString() ?? null,
    attendanceOnly: summary.attendanceOnly,
    attendanceReadOnly:
      context.staffUser.role === "TEACHER" &&
      summary.attendanceOnly &&
      dateOnly(session.date) !== saoPauloDateOnly(context.now),
    restriction: writeRestriction(context, session),
    snapshot: storedSnapshot(session) ?? (await initialSnapshot(context, session)),
  };
}
export async function classRecordHistory(
  context: RecordContext,
  input: { sessionId: string; cursor?: number | undefined },
): Promise<RevisionPage<ClassRecordRevision>> {
  const session = await loadRecordSession(context, input.sessionId);
  if (!session.classRecord) return { items: [], nextCursor: undefined };
  const rows = await context.database.classSessionRecordRevision.findMany({
    where: {
      recordId: session.classRecord.id,
      ...(input.cursor ? { version: { lt: input.cursor } } : {}),
    },
    orderBy: { version: "desc" },
    take: HISTORY_PAGE_SIZE + 1,
    include: { recordedBy: { select: { name: true } } },
  });
  const items = rows.slice(0, HISTORY_PAGE_SIZE).map((row) => {
    const snapshot = classRecordSnapshotSchema.parse(row.snapshot);
    const origin = snapshot.attendanceOrigin?.priorState ? snapshot.attendanceOrigin : undefined;
    return {
      id: row.id,
      version: row.version,
      reason: row.reason,
      author: origin ? (origin.confirmedBy?.name ?? "Autoria não registrada") : row.recordedBy.name,
      authorId: origin ? (origin.confirmedBy?.id ?? null) : row.recordedById,
      recordedAt: row.createdAt,
      snapshot,
    };
  });
  return { items, nextCursor: rows.length > HISTORY_PAGE_SIZE ? items.at(-1)?.version : undefined };
}

const PENDING_PAGE_SIZE = 25;
/** Pending records remain discoverable after the encounter's week has ended. */
export async function pendingClassRecords(
  context: RecordContext,
  input: { page: number },
): Promise<{ rows: SessionSummary[]; total: number; page: number; pageCount: number }> {
  const sessions = await context.database.classSession.findMany({
    where: {
      deletedAt: null,
      class: { deletedAt: null },
      status: "SCHEDULED",
      classRecord: null,
      date: { lte: new Date(saoPauloDateOnly(context.now)) },
    },
    include: recordSessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  const visible = sessions.filter(
    (session) => canRead(context, session) && sessionEndInstant(session) <= context.now,
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PENDING_PAGE_SIZE));
  const page = Math.min(input.page, pageCount);
  const start = (page - 1) * PENDING_PAGE_SIZE;
  const pageRows = visible.slice(start, start + PENDING_PAGE_SIZE);
  const guests = await sessionGuests(context, pageRows);
  return {
    rows: pageRows.map((session) =>
      summarizeSession(session, {
        now: context.now,
        leadGuests: guests.get(session.id)?.leads ?? [],
        guestCount:
          (guests.get(session.id)?.appointments.length ?? 0) +
          (guests.get(session.id)?.leads.length ?? 0),
      }),
    ),
    total: visible.length,
    page,
    pageCount,
  };
}
