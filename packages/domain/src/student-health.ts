export const STUDENT_HEALTH_WEIGHTS = {
  attendance: 35,
  grades: 30,
  occurrences: 20,
  interventions: 15,
} as const;

export type StudentHealthIndicator = keyof typeof STUDENT_HEALTH_WEIGHTS;
export type StudentHealthLevel = "INSUFFICIENT_DATA" | "HEALTHY" | "ATTENTION" | "PRIORITY";
export type StudentHealthResult = {
  score: number | null;
  level: StudentHealthLevel;
  indicators: { key: StudentHealthIndicator; weight: number; score: number | null }[];
  availableIndicators: number;
};
export type StudentHealthInput = {
  attendancePercent: number | null;
  grades: readonly number[];
  heldSessions: number;
  occurrenceCount: number;
  accompaniedOccurrences: number;
};

const PERCENT = 100;
const OCCURRENCE_PENALTY = 10;
const HEALTHY_SCORE = 80;
const ATTENTION_SCORE = 60;

function healthLevel(score: number | null): StudentHealthLevel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score >= HEALTHY_SCORE) return "HEALTHY";
  if (score >= ATTENTION_SCORE) return "ATTENTION";
  return "PRIORITY";
}

/** Initial, transparent policy: missing evidence never becomes a zero grade. */
export function calculateStudentHealth(input: StudentHealthInput): StudentHealthResult {
  const scores: Record<StudentHealthIndicator, number | null> = {
    attendance: input.attendancePercent === null ? null : input.attendancePercent * PERCENT,
    grades:
      input.grades.length > 0
        ? input.grades.reduce((sum, grade) => sum + grade, 0) / input.grades.length
        : null,
    occurrences:
      input.heldSessions > 0 || input.occurrenceCount > 0
        ? Math.max(0, PERCENT - input.occurrenceCount * OCCURRENCE_PENALTY)
        : null,
    interventions:
      input.occurrenceCount > 0
        ? (input.accompaniedOccurrences / input.occurrenceCount) * PERCENT
        : null,
  };
  const indicators = (Object.keys(STUDENT_HEALTH_WEIGHTS) as StudentHealthIndicator[]).map(
    (key) => ({
      key,
      weight: STUDENT_HEALTH_WEIGHTS[key],
      score: scores[key] === null ? null : Math.max(0, Math.min(PERCENT, scores[key])),
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
    level: healthLevel(score),
    indicators,
    availableIndicators: available.length,
  };
}
