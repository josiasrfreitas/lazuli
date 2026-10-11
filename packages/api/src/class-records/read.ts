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
} from "./data.js";
import { initialSnapshot } from "./planned.js";
export async function listClassRecords(
  context: RecordContext,
  input: z.infer<typeof classRecordListSchema>,
) {
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
  return sessions
    .filter((session) => canRead(context, session))
    .map((session) => ({
      id: session.id,
      classId: session.classId,
      className: session.class.portalClassName,
      scheduleType: session.class.scheduleType,
      date: dateOnly(session.date),
      startTime: timeOnly(session.startTime),
      endTime: timeOnly(session.endTime),
      teacher: responsibleTeacher(session)?.name ?? null,
      state:
        session.status === "CANCELLED"
          ? ("CANCELLED" as const)
          : session.classRecord
            ? ("RECORDED" as const)
            : ("PENDING" as const),
      attendanceOnly: Boolean(session.attendanceConfirmedAt && !session.classRecord),
    }));
}
export async function readClassRecord(context: RecordContext, sessionId: string) {
  const session = await loadRecordSession(context, sessionId);
  const record = session.classRecord;
  return {
    session: {
      id: session.id,
      classId: session.classId,
      className: session.class.portalClassName,
      scheduleType: session.class.scheduleType,
      date: dateOnly(session.date),
      startTime: timeOnly(session.startTime),
      endTime: timeOnly(session.endTime),
      cancelled: session.status === "CANCELLED",
      cancelReason: session.cancelReason,
      teacher: responsibleTeacher(session)?.name ?? null,
    },
    version: record?.version ?? 0,
    recordedAt: record?.createdAt ?? null,
    attendanceStamp: session.attendanceLastCommittedAt?.toISOString() ?? null,
    attendanceOnly: Boolean(session.attendanceConfirmedAt && !record),
    restriction: writeRestriction(context, session),
    snapshot: storedSnapshot(session) ?? (await initialSnapshot(context, session)),
  };
}
export async function classRecordHistory(
  context: RecordContext,
  input: { sessionId: string; cursor?: number | undefined },
) {
  const session = await loadRecordSession(context, input.sessionId);
  if (!session.classRecord) return { items: [], nextCursor: undefined };
  const rows = await context.database.classSessionRecordRevision.findMany({
    where: {
      recordId: session.classRecord.id,
      ...(input.cursor ? { version: { lt: input.cursor } } : {}),
    },
    orderBy: { version: "desc" },
    take: 21,
    include: { recordedBy: { select: { name: true } } },
  });
  const items = rows
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      version: row.version,
      reason: row.reason,
      author: row.recordedBy.name,
      authorId: row.recordedById,
      recordedAt: row.createdAt,
      snapshot: classRecordSnapshotSchema.parse(row.snapshot),
    }));
  return { items, nextCursor: rows.length > 20 ? items.at(-1)?.version : undefined };
}
