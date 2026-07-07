import type { attendanceEditSessionInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import { assertAttendanceWriteWindow } from "./access.js";
import {
  loadActiveRoster,
  loadSessionWithClass,
  type AttendanceDatabase,
  type SessionWithClass,
} from "./data.js";
import {
  ATTENDANCE_NOT_CONFIRMED_MESSAGE,
  ROSTER_COUNT_MISMATCH_MESSAGE,
  SESSION_CANCELLED_MESSAGE,
  badRequest,
} from "./errors.js";
import { buildRequestedStatuses, type AttendanceStatus } from "./rows.js";

type EditInput = z.infer<typeof attendanceEditSessionInputSchema>;

export type EditSessionResult = {
  sessionId: string;
  changedCount: number;
  presentCount: number;
  absentCount: number;
  latestCommittedAt: Date;
};

export async function editSession(input: {
  database: AttendanceDatabase;
  staffUser: StaffUser;
  values: EditInput;
  now: Date;
}): Promise<EditSessionResult> {
  const session = await loadEditableSession(input);

  const roster = await loadActiveRoster({
    database: input.database,
    classId: session.classId,
    date: session.date,
  });
  const requested = buildRequestedStatuses(input.values.rows, roster);
  const committed = await loadCommittedRows({
    database: input.database,
    sessionId: session.id,
  });
  if (committed.size !== roster.length) {
    throw badRequest(ROSTER_COUNT_MISMATCH_MESSAGE);
  }

  const changed = await writeChangedRows({
    database: input.database,
    sessionId: session.id,
    requested,
    committed,
    modifiedAt: input.now,
    modifiedById: input.staffUser.id,
  });
  const latestCommittedAt =
    changed > 0
      ? await stampSessionEdited({
          database: input.database,
          sessionId: session.id,
          committedAt: input.now,
        })
      : (session.attendanceLastCommittedAt ?? session.attendanceConfirmedAt);

  return summarize({
    sessionId: session.id,
    changedCount: changed,
    latestCommittedAt,
    statuses: applyRequestedStatuses({ committed, requested }),
  });
}

async function loadEditableSession(input: {
  database: AttendanceDatabase;
  staffUser: StaffUser;
  values: EditInput;
  now: Date;
}): Promise<SessionWithClass & { attendanceConfirmedAt: Date }> {
  const session = await loadSessionWithClass({
    database: input.database,
    sessionId: input.values.sessionId,
  });
  assertResourceScope(input.staffUser, { teacherId: session.class.teacherId });
  assertAttendanceWriteWindow({
    staffUser: input.staffUser,
    sessionDate: session.date,
    now: input.now,
  });
  assertEditable(session);

  return session;
}

function assertEditable(session: SessionWithClass): asserts session is SessionWithClass & {
  attendanceConfirmedAt: Date;
} {
  if (session.status === "CANCELLED") {
    throw badRequest(SESSION_CANCELLED_MESSAGE);
  }
  if (session.attendanceConfirmedAt === null) {
    throw badRequest(ATTENDANCE_NOT_CONFIRMED_MESSAGE);
  }
}

async function loadCommittedRows(input: {
  database: AttendanceDatabase;
  sessionId: string;
}): Promise<Map<string, AttendanceStatus>> {
  const rows = await input.database.attendance.findMany({
    where: { classSessionId: input.sessionId },
    select: { enrollmentId: true, status: true },
  });

  return new Map(rows.map((row) => [row.enrollmentId, row.status]));
}

async function writeChangedRows(input: {
  database: AttendanceDatabase;
  sessionId: string;
  requested: Map<string, AttendanceStatus>;
  committed: Map<string, AttendanceStatus>;
  modifiedAt: Date;
  modifiedById: string;
}): Promise<number> {
  let changed = 0;
  for (const [enrollmentId, status] of input.requested) {
    if (input.committed.get(enrollmentId) === status) {
      continue;
    }
    const updated = await input.database.attendance.updateMany({
      where: { classSessionId: input.sessionId, enrollmentId },
      data: {
        status,
        lastModifiedAt: input.modifiedAt,
        lastModifiedById: input.modifiedById,
      },
    });
    changed += updated.count;
  }

  return changed;
}

async function stampSessionEdited(input: {
  database: AttendanceDatabase;
  sessionId: string;
  committedAt: Date;
}): Promise<Date> {
  const session = await input.database.classSession.update({
    where: { id: input.sessionId },
    data: { attendanceLastCommittedAt: input.committedAt },
    select: { attendanceLastCommittedAt: true },
  });

  return session.attendanceLastCommittedAt ?? input.committedAt;
}

function applyRequestedStatuses(input: {
  committed: Map<string, AttendanceStatus>;
  requested: Map<string, AttendanceStatus>;
}): AttendanceStatus[] {
  const statuses = new Map(input.committed);
  for (const [enrollmentId, status] of input.requested) {
    statuses.set(enrollmentId, status);
  }

  return [...statuses.values()];
}

function summarize(input: {
  sessionId: string;
  changedCount: number;
  latestCommittedAt: Date;
  statuses: AttendanceStatus[];
}): EditSessionResult {
  let absentCount = 0;
  for (const status of input.statuses) {
    if (status === "ABSENT") {
      absentCount += 1;
    }
  }

  return {
    sessionId: input.sessionId,
    changedCount: input.changedCount,
    latestCommittedAt: input.latestCommittedAt,
    presentCount: input.statuses.length - absentCount,
    absentCount,
  };
}
