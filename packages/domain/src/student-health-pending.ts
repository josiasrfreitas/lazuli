export const LOW_HEALTH_SCORE = 70;
export const HEALTH_RECOVERY_MS = 7 * 24 * 60 * 60 * 1000;
type HealthPendingState = { openedAt: Date | null; recoveredAt: Date | null };

/** Recovery belongs to a previously low score; missing data cannot prove recovery. */
export function nextHealthPendingState(
  previous: HealthPendingState | null,
  score: number | null,
  now: Date,
): HealthPendingState {
  if (score === null) return { openedAt: null, recoveredAt: null };
  if (score < LOW_HEALTH_SCORE) return { openedAt: previous?.openedAt ?? now, recoveredAt: null };
  if (!previous?.openedAt) return { openedAt: null, recoveredAt: null };
  const recoveredAt = previous.recoveredAt ?? now;
  if (now.getTime() - recoveredAt.getTime() >= HEALTH_RECOVERY_MS)
    return { openedAt: null, recoveredAt: null };
  return { openedAt: previous.openedAt, recoveredAt };
}
