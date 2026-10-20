import type { AssessmentSave } from "@lazuli/validators";
import { recordActivity } from "../activity/record.js";
import { dateOnly, type AssessmentContext, type Progress } from "./data.js";
const competencies = {
  ORAL: "Oral",
  LISTENING: "Listening",
  WRITTEN: "Written",
  PARTICIPATION: "Participação",
};
const phases = { BLOCK_ONE: "Unidade 1", BLOCK_TWO: "Unidade 2", RECOVERY: "Recuperação" };
const dateLabel = (date: string): string => date.split("-").reverse().join("/");
export async function recordAssessmentChanges(
  context: AssessmentContext,
  progress: Progress,
  values: AssessmentSave,
  changes: AssessmentSave["grades"],
  observations: AssessmentSave["grades"] = [],
): Promise<void> {
  const lines = changes.map((grade) => {
    const previous = progress.assessment?.grades.find(
      (row) => row.phase === grade.phase && row.competence === grade.competence,
    );
    const before = previous
      ? `${Number(previous.score)} em ${dateLabel(dateOnly(previous.assessedOn))}, por ${previous.recordedBy.name}`
      : "sem nota";
    const after =
      grade.score === null ? "nota removida" : `${grade.score} em ${dateLabel(grade.assessedOn!)}`;
    return `${competencies[grade.competence]} · ${phases[grade.phase]}: ${before} → ${after}.${grade.reason ? ` ${grade.reason}` : ""}`;
  });
  await recordActivity(context.database, context, "assessments.save", {
    subject: {
      type: "student",
      id: progress.enrollment.studentId,
      name: `${progress.enrollment.student.fullName} · ${progress.stage.name}`,
    },
    description: [
      ...lines,
      ...observations.map(
        (grade) =>
          `${competencies[grade.competence]} · ${phases[grade.phase]}: ${
            grade.notes ? `Observações: ${grade.notes}` : "Observações removidas."
          }`,
      ),
      values.correctionReason ?? "",
      changes.length > 0 && progress.assessment?.confirmedAt
        ? "A confirmação pedagógica anterior foi retirada."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
