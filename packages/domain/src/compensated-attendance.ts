import type { AttendancePercent } from "./attendance-percent.js";
const MIN_ATTENDANCE_PERCENT = 0.75;

export type AttendanceProgress = AttendancePercent & {
  heldMinutes: number;
  presentMinutes: number;
  compensatedMinutes: number;
  missingMinutes: number;
};
type ConfirmedSession = {
  minutes: number;
  status: "PRESENT" | "ABSENT" | null;
  compensatedMinutes: number;
};
/** Source attendance remains authoritative; compensation can only cover an absent part once. */
export function computeCompensatedAttendance(
  sessions: readonly ConfirmedSession[],
): AttendanceProgress {
  let heldMinutes = 0;
  let presentMinutes = 0;
  let compensatedMinutes = 0;
  let presentCount = 0;
  for (const session of sessions) {
    const minutes = Math.max(0, session.minutes);
    heldMinutes += minutes;
    if (session.status === "PRESENT") {
      presentMinutes += minutes;
      presentCount += 1;
    }
    if (session.status === "ABSENT")
      compensatedMinutes += Math.min(minutes, Math.max(0, session.compensatedMinutes));
  }
  return attendanceProgressFromTotals({
    heldSessions: sessions.length,
    presentCount,
    heldMinutes,
    presentMinutes,
    compensatedMinutes,
  });
}

/** Totals must already cap compensation at each absent session's duration. */
export function attendanceProgressFromTotals(
  totals: Pick<
    AttendanceProgress,
    "heldSessions" | "presentCount" | "heldMinutes" | "presentMinutes" | "compensatedMinutes"
  >,
): AttendanceProgress {
  const { heldMinutes, presentMinutes, compensatedMinutes } = totals;
  const percent = heldMinutes > 0 ? (presentMinutes + compensatedMinutes) / heldMinutes : null;
  return {
    ...totals,
    missingMinutes: heldMinutes - presentMinutes - compensatedMinutes,
    percent,
    flagged: percent !== null && percent < MIN_ATTENDANCE_PERCENT,
  };
}
