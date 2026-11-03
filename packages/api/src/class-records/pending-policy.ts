const DAY_MS = 86_400_000;
const PENDING_AFTER_DAYS = 3;

/** A missing class record becomes an operational pending item after three days. */
export function pendingClassRecordCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_AFTER_DAYS * DAY_MS);
}
