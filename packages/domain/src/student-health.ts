export const STUDENT_HEALTH_WEIGHTS = {
  attendance: 35,
  grades: 30,
  occurrences: 20,
  interventions: 15,
} as const;

export type StudentHealthIndicator = keyof typeof STUDENT_HEALTH_WEIGHTS;
export type StudentHealthInput = {
  attendancePercent: number | null;
  grades: readonly number[];
  heldSessions: number;
  occurrenceCount: number;
  accompaniedOccurrences: number;
};

/** Initial, transparent policy: missing evidence never becomes a zero grade. */
export function calculateStudentHealth(input: StudentHealthInput) {
  const scores: Record<StudentHealthIndicator, number | null> = {
    attendance: input.attendancePercent === null ? null : input.attendancePercent * 100,
    grades: input.grades.length
      ? input.grades.reduce((sum, grade) => sum + grade, 0) / input.grades.length
      : null,
    occurrences:
      input.heldSessions > 0 || input.occurrenceCount > 0
        ? Math.max(0, 100 - input.occurrenceCount * 10)
        : null,
    interventions:
      input.occurrenceCount > 0
        ? (input.accompaniedOccurrences / input.occurrenceCount) * 100
        : null,
  };
  const indicators = (Object.keys(STUDENT_HEALTH_WEIGHTS) as StudentHealthIndicator[]).map(
    (key) => ({
      key,
      weight: STUDENT_HEALTH_WEIGHTS[key],
      score: scores[key] === null ? null : Math.max(0, Math.min(100, scores[key])),
    }),
  );
  const available = indicators.filter((indicator) => indicator.score !== null);
  const weight = available.reduce((sum, indicator) => sum + indicator.weight, 0);
  const score =
    weight > 0
      ? Math.round(
          available.reduce((sum, indicator) => sum + indicator.score! * indicator.weight, 0) /
            weight,
        )
      : null;
  return {
    score,
    level:
      score === null
        ? ("INSUFFICIENT_DATA" as const)
        : score >= 80
          ? ("HEALTHY" as const)
          : score >= 60
            ? ("ATTENTION" as const)
            : ("PRIORITY" as const),
    indicators,
    availableIndicators: available.length,
  };
}
