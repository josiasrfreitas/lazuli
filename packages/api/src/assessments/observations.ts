import { assessmentObservationsSchema, type AssessmentSave } from "@lazuli/validators";
import type { Progress } from "./data.js";

export function assessmentObservations(progress: Progress) {
  return assessmentObservationsSchema.parse(progress.assessment?.observations ?? []);
}

export function observationChanges(progress: Progress, values: AssessmentSave) {
  const previous = assessmentObservations(progress);
  return values.grades.filter(
    (grade) =>
      grade.notes !== undefined &&
      (grade.notes?.trim() ?? "") !==
        (previous.find((row) => row.phase === grade.phase && row.competence === grade.competence)
          ?.notes ?? ""),
  );
}

export function mergeObservations(progress: Progress, changes: AssessmentSave["grades"]) {
  const rows = new Map(
    assessmentObservations(progress).map((row) => [`${row.phase}/${row.competence}`, row]),
  );
  for (const grade of changes) {
    const key = `${grade.phase}/${grade.competence}`;
    if (grade.notes?.trim())
      rows.set(key, {
        phase: grade.phase,
        competence: grade.competence,
        notes: grade.notes.trim(),
      });
    else rows.delete(key);
  }
  return [...rows.values()];
}
