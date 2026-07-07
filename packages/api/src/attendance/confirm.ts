import type { attendanceConfirmSessionInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import {
  loadActiveRoster,
  loadSessionWithClass,
  type AttendanceDatabase,
  type RosterEnrollment,
  type SessionWithClass,
} from "./data.js";
import {
  ALREADY_CONFIRMED_MESSAGE,
  DUPLICATE_ROSTER_ROW_MESSAGE,
  ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
  ROSTER_COUNT_MISMATCH_MESSAGE,
  SESSION_CANCELLED_MESSAGE,
  badRequest,
} from "./errors.js";

type ConfirmInput = z.infer<typeof attendanceConfirmSessionInputSchema>;
type ConfirmRow = ConfirmInput["rows"][number];
type AttendanceStatus = ConfirmRow["status"];

const PRESENT = "PRESENT" as const;
const ABSENT = "ABSENT" as const;

export type ConfirmSessionResult = {
  sessionId: string;
  confirmedAt: Date;
  rosterCount: number;
  presentCount: number;
  absentCount: number;
};

/**
 * The one-shot, transactional attendance confirm (S-ATT-1, TECHNICAL_SPEC §4.6). No server-side draft:
 * every write happens here. Untouched active-roster members commit `PRESENT`; `rows` entries commit their
 * explicit status. Rejects re-confirm, cancelled sessions, and `rows` outside the session roster.
 */
export async function confirmSession(input: {
  database: AttendanceDatabase;
  staffUser: StaffUser;
  values: ConfirmInput;
}): Promise<ConfirmSessionResult> {
  const session = await loadSessionWithClass({
    database: input.database,
    sessionId: input.values.sessionId,
  });
  assertResourceScope(input.staffUser, { teacherId: session.class.teacherId });
  assertConfirmable(session);

  const roster = await loadActiveRoster({
    database: input.database,
    classId: session.classId,
    date: session.date,
  });
  const requested = buildRequestedStatuses(input.values.rows, roster);

  const confirmedAt = new Date();
  await writeAttendanceRows({
    database: input.database,
    sessionId: session.id,
    roster,
    requested,
    recordedById: input.staffUser.id,
  });
  await stampSessionConfirmed({
    database: input.database,
    sessionId: session.id,
    staffUserId: input.staffUser.id,
    confirmedAt,
  });

  return summarize({ sessionId: session.id, confirmedAt, roster, requested });
}

function assertConfirmable(session: SessionWithClass): void {
  if (session.status === "CANCELLED") {
    throw badRequest(SESSION_CANCELLED_MESSAGE);
  }
  if (session.attendanceConfirmedAt !== null) {
    throw badRequest(ALREADY_CONFIRMED_MESSAGE);
  }
}

/** Maps `rows` to an enrollment→status lookup, rejecting off-roster and duplicate entries. */
function buildRequestedStatuses(
  rows: ConfirmRow[],
  roster: RosterEnrollment[],
): Map<string, AttendanceStatus> {
  const rosterIds = new Set(roster.map((member) => member.enrollmentId));
  const requested = new Map<string, AttendanceStatus>();

  for (const row of rows) {
    if (!rosterIds.has(row.enrollmentId)) {
      throw badRequest(ENROLLMENT_NOT_ON_ROSTER_MESSAGE);
    }
    if (requested.has(row.enrollmentId)) {
      throw badRequest(DUPLICATE_ROSTER_ROW_MESSAGE);
    }
    requested.set(row.enrollmentId, row.status);
  }

  return requested;
}

async function writeAttendanceRows(input: {
  database: AttendanceDatabase;
  sessionId: string;
  roster: RosterEnrollment[];
  requested: Map<string, AttendanceStatus>;
  recordedById: string;
}): Promise<void> {
  const data = input.roster.map((member) => ({
    enrollmentId: member.enrollmentId,
    classSessionId: input.sessionId,
    status: input.requested.get(member.enrollmentId) ?? PRESENT,
    recordedById: input.recordedById,
  }));

  const created = await input.database.attendance.createMany({ data });
  // Roster-count invariant (§4.6): one committed row per active-roster member, no more, no fewer.
  if (created.count !== input.roster.length) {
    throw badRequest(ROSTER_COUNT_MISMATCH_MESSAGE);
  }
}

async function stampSessionConfirmed(input: {
  database: AttendanceDatabase;
  sessionId: string;
  staffUserId: string;
  confirmedAt: Date;
}): Promise<void> {
  await input.database.classSession.update({
    where: { id: input.sessionId },
    data: {
      attendanceConfirmedAt: input.confirmedAt,
      attendanceConfirmedById: input.staffUserId,
      attendanceLastCommittedAt: input.confirmedAt,
    },
    select: { id: true },
  });
}

function summarize(input: {
  sessionId: string;
  confirmedAt: Date;
  roster: RosterEnrollment[];
  requested: Map<string, AttendanceStatus>;
}): ConfirmSessionResult {
  let absentCount = 0;
  for (const member of input.roster) {
    if (input.requested.get(member.enrollmentId) === ABSENT) {
      absentCount += 1;
    }
  }

  return {
    sessionId: input.sessionId,
    confirmedAt: input.confirmedAt,
    rosterCount: input.roster.length,
    presentCount: input.roster.length - absentCount,
    absentCount,
  };
}
