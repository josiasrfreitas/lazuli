/** Descriptive mean of recorded grades; academic approval still uses competence results. */
export function gradeAverage(grades: readonly { score: number }[]): number | null {
  if (grades.length === 0) return null;
  return grades.reduce((total, grade) => total + grade.score, 0) / grades.length;
}
