/** Minimal semester window shape; decoupled from Prisma so the domain stays pure. */
export type SemesterWindow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

/** Why a date failed to map to exactly one semester (§6.2, §7.2). */
export type SemesterBucketErrorCode = "NO_SEMESTER" | "MULTIPLE_SEMESTERS";

/**
 * Setup error raised when a session date does not bucket into exactly one
 * semester, so session generation and reports fail loudly instead of silently
 * omitting the session (§6.2, §7.2). Carries a stable `code`; callers map it to
 * a Portuguese-BR message at the API/report boundary (§3.3).
 */
export class SemesterBucketError extends Error {
  readonly code: SemesterBucketErrorCode;

  constructor(code: SemesterBucketErrorCode) {
    super(`Date maps to ${code === "NO_SEMESTER" ? "no" : "multiple"} semester window(s).`);
    this.name = "SemesterBucketError";
    this.code = code;
  }
}

/** Returns the semester whose inclusive `[startDate, endDate]` window contains `date`. */
export function resolveSemesterForDate(
  date: Date,
  semesters: readonly SemesterWindow[],
): SemesterWindow {
  const [match, ...extraMatches] = semesters.filter(
    (semester) => semester.startDate <= date && date <= semester.endDate,
  );

  if (match === undefined) {
    throw new SemesterBucketError("NO_SEMESTER");
  }

  if (extraMatches.length > 0) {
    throw new SemesterBucketError("MULTIPLE_SEMESTERS");
  }

  return match;
}
