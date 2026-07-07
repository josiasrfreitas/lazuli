import type { RosterEnrollment } from "./data.js";
import {
  DUPLICATE_ROSTER_ROW_MESSAGE,
  ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
  badRequest,
} from "./errors.js";

export type AttendanceStatus = "PRESENT" | "ABSENT";

export type AttendanceInputRow = {
  enrollmentId: string;
  status: AttendanceStatus;
};

/** Maps requested rows to an enrollment->status lookup, rejecting off-roster and duplicate entries. */
export function buildRequestedStatuses(
  rows: AttendanceInputRow[],
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
