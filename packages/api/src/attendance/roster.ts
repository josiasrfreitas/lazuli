import { isSessionUntaken } from "@lazuli/domain";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import {
  loadActiveRoster,
  loadSessionWithClass,
  type AttendanceDatabase,
  type SessionWithClass,
} from "./data.js";

const PRESENT = "PRESENT" as const;

type CommittedStatus = "PRESENT" | "ABSENT";

export type SessionRosterEntry = {
  enrollmentId: string;
  studentId: string;
  studentFullName: string;
  /** The UI pre-selects PRESENT; the teacher only toggles absentees (S-ATT-1). */
  defaultStatus: "PRESENT";
  /** The committed status once the session is confirmed, else `null` (nothing persisted before confirm). */
  committedStatus: CommittedStatus | null;
};

export type SessionRosterView = {
  id: string;
  classId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  status: "SCHEDULED" | "CANCELLED";
  attendanceConfirmedAt: Date | null;
  attendanceConfirmedById: string | null;
  untaken: boolean;
};

export type SessionRosterResult = {
  session: SessionRosterView;
  entries: SessionRosterEntry[];
  /** Makeup visitors render here once GRE-35 ships; empty until then (S-ATT-2). */
  makeupVisitors: never[];
};

export async function readSessionRoster(input: {
  database: AttendanceDatabase;
  staffUser: StaffUser;
  sessionId: string;
}): Promise<SessionRosterResult> {
  const session = await loadSessionWithClass({
    database: input.database,
    sessionId: input.sessionId,
  });
  assertResourceScope(input.staffUser, { teacherId: session.class.teacherId });

  const roster = await loadActiveRoster({
    database: input.database,
    classId: session.classId,
    date: session.date,
  });
  const committed = await loadCommittedStatuses({
    database: input.database,
    sessionId: session.id,
  });

  const entries = roster.map((member) => ({
    enrollmentId: member.enrollmentId,
    studentId: member.studentId,
    studentFullName: member.studentFullName,
    defaultStatus: PRESENT,
    committedStatus: committed.get(member.enrollmentId) ?? null,
  }));

  return { session: toSessionView(session), entries, makeupVisitors: [] };
}

async function loadCommittedStatuses(input: {
  database: AttendanceDatabase;
  sessionId: string;
}): Promise<Map<string, CommittedStatus>> {
  const rows = await input.database.attendance.findMany({
    where: { classSessionId: input.sessionId },
    select: { enrollmentId: true, status: true },
  });

  return new Map(rows.map((row) => [row.enrollmentId, row.status]));
}

function toSessionView(session: SessionWithClass): SessionRosterView {
  return {
    id: session.id,
    classId: session.classId,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    attendanceConfirmedAt: session.attendanceConfirmedAt,
    attendanceConfirmedById: session.attendanceConfirmedById,
    untaken: isSessionUntaken({
      status: session.status,
      date: session.date,
      endTime: session.endTime,
      attendanceConfirmedAt: session.attendanceConfirmedAt,
      now: new Date(),
    }),
  };
}
