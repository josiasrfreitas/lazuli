import type { AttendancePercent } from "./attendance-percent.js";

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
  const percent = heldMinutes > 0 ? (presentMinutes + compensatedMinutes) / heldMinutes : null;
  return {
    heldSessions: sessions.length,
    presentCount,
    heldMinutes,
    presentMinutes,
    compensatedMinutes,
    missingMinutes: heldMinutes - presentMinutes - compensatedMinutes,
    percent,
    flagged: percent !== null && percent < 0.75,
  };
}
