/** Per Coordinator A, the attendance minimum is 75% per (enrollment, semester) — `att_min_pct`. */
const DEFAULT_ATTENDANCE_MIN_PCT = 0.75;

export type AttendancePercent = {
  heldSessions: number;
  presentCount: number;
  /** Fraction in [0, 1], or null ("sem dados") when no sessions have been held. */
  percent: number | null;
  flagged: boolean;
};

/**
 * Computes the per-(enrollment, semester) attendance percentage and at-risk flag
 * (§4.6, D-0029). The caller supplies `heldSessions` / `presentCount` already
 * filtered to non-cancelled, confirmed sessions inside the Semester ∩ Enrollment
 * window; makeups are excluded from both counts. An empty denominator renders as
 * "sem dados" (percent null) and is never flagged.
 */
export function computeAttendancePercent(input: {
  heldSessions: number;
  presentCount: number;
  minPct?: number;
}): AttendancePercent {
  const minPct = input.minPct ?? DEFAULT_ATTENDANCE_MIN_PCT;

  if (input.heldSessions === 0) {
    return {
      heldSessions: 0,
      presentCount: input.presentCount,
      percent: null,
      flagged: false,
    };
  }

  const percent = input.presentCount / input.heldSessions;

  return {
    heldSessions: input.heldSessions,
    presentCount: input.presentCount,
    percent,
    flagged: percent < minPct,
  };
}
