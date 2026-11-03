export const LOW_HEALTH_SCORE = 70;
const RECOVERY_DAYS = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
export const HEALTH_RECOVERY_MS =
  RECOVERY_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
type HealthPendingState = { openedAt: Date | null; recoveredAt: Date | null };

/** Recovery belongs to a previously low score; missing data cannot prove recovery. */
export function nextHealthPendingState(
  ...[previous, score, now]: [HealthPendingState | null, number | null, Date]
): HealthPendingState {
  if (score === null) return { openedAt: null, recoveredAt: null };
  if (score < LOW_HEALTH_SCORE) return { openedAt: previous?.openedAt ?? now, recoveredAt: null };
  if (!previous?.openedAt) return { openedAt: null, recoveredAt: null };
  const recoveredAt = previous.recoveredAt ?? now;
  if (now.getTime() - recoveredAt.getTime() >= HEALTH_RECOVERY_MS)
    return { openedAt: null, recoveredAt: null };
  return { openedAt: previous.openedAt, recoveredAt };
}
