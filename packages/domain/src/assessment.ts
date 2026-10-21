export const ACADEMIC_COMPETENCES = ["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"] as const;
export type AcademicCompetence = (typeof ACADEMIC_COMPETENCES)[number];
export type AssessmentPhase = "BLOCK_ONE" | "BLOCK_TWO" | "RECOVERY";
export const ACADEMIC_PASS_SCORE = 60;
export const ACADEMIC_MAX_SCORE = 100;
export type AcademicGrade = {
  competence: AcademicCompetence;
  phase: AssessmentPhase;
  score: number;
};
export type CompetenceResult = {
  competence: AcademicCompetence;
  blockOne: number | null;
  blockTwo: number | null;
  average: number | null;
  recovery: number | null;
  effective: number | null;
  passed: boolean | null;
};

function blockAverage(one: number | null, two: number | null): number | null {
  if (one === null || two === null) return null;
  return (one + two) / 2;
}

/** Missing grades stay unknown; no overall mean can compensate for a failed competence. */
export function assessmentResults(grades: readonly AcademicGrade[]): CompetenceResult[] {
  return ACADEMIC_COMPETENCES.map((competence) => {
    const own = grades.filter((grade) => grade.competence === competence);
    const blockOne = own.find((grade) => grade.phase === "BLOCK_ONE")?.score ?? null;
    const blockTwo = own.find((grade) => grade.phase === "BLOCK_TWO")?.score ?? null;
    const recovery = own.find((grade) => grade.phase === "RECOVERY")?.score ?? null;
    const average = blockAverage(blockOne, blockTwo);
    const effective = average === null ? null : (recovery ?? average);
    return {
      competence,
      blockOne,
      blockTwo,
      average,
      recovery,
      effective,
      passed: effective === null ? null : effective >= ACADEMIC_PASS_SCORE,
    };
  });
}
export function assessmentStatus(
  results: readonly CompetenceResult[],
): "INCOMPLETE" | "SUFFICIENT" | "NEEDS_SUPPORT" {
  if (
    results.length !== ACADEMIC_COMPETENCES.length ||
    results.some((result) => result.effective === null)
  )
    return "INCOMPLETE";
  return results.every((result) => result.passed) ? "SUFFICIENT" : "NEEDS_SUPPORT";
}
