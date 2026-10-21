import { ACADEMIC_COMPETENCES, saoPauloDateOnly } from "@lazuli/domain";
import type { AssessmentSave } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import {
  assertAssessmentDateAccess,
  dateOnly,
  type AssessmentContext,
  type Progress,
} from "./data.js";

type GradeInput = AssessmentSave["grades"][number];
export function gradeChanges(progress: Progress, values: AssessmentSave): GradeInput[] {
  return values.grades.filter((grade) => {
    const previous = progress.assessment?.grades.find(
      (row) => row.phase === grade.phase && row.competence === grade.competence,
    );
    if (!previous) return grade.score !== null;
    return (
      grade.score !== Number(previous.score) ||
      grade.assessedOn !== dateOnly(previous.assessedOn) ||
      (grade.phase === "RECOVERY" && grade.reason !== previous.reason)
    );
  });
}
export async function assertGradeChanges(
  context: AssessmentContext,
  options: {
    progress: Progress;
    values: AssessmentSave;
    changes: GradeInput[];
  },
): Promise<void> {
  const { progress, values, changes } = options;

  if ((progress.assessment?.version ?? 0) !== values.version)
    throw badRequest(
      "As notas foram alteradas por outra pessoa. Atualize a página antes de salvar.",
    );
  if (changes.length > 0 && progress.assessment?.confirmedAt && !values.correctionReason?.trim())
    throw badRequest("Justifique a correção das notas já confirmadas.");
  const start = dateOnly(progress.assessment?.startedOn ?? progress.startDate);
  const today = saoPauloDateOnly(context.now);
  if (dateOnly(progress.startDate) > today) throw badRequest("Este estágio ainda não começou.");
  for (const grade of changes) {
    await assertCorrectionAccess(context, { progress, grade });
    if (grade.score === null) continue;
    if (
      !grade.assessedOn ||
      grade.assessedOn < start ||
      grade.assessedOn > today ||
      (progress.endDate && grade.assessedOn > dateOnly(progress.endDate))
    )
      throw badRequest(
        "A data da avaliação deve estar no percurso do estágio e não pode estar no futuro.",
      );
    await assertAssessmentDateAccess(context, { progress, date: new Date(grade.assessedOn) });
  }
  assertGradeSequence(mergedGrades(progress, changes));
}
async function assertCorrectionAccess(
  context: AssessmentContext,
  options: {
    progress: Progress;
    grade: GradeInput;
  },
): Promise<void> {
  const { progress, grade } = options;

  if (context.staffUser.role !== "TEACHER") return;
  const previous = progress.assessment?.grades.find(
    (row) => row.phase === grade.phase && row.competence === grade.competence,
  );
  const dates = [grade.assessedOn, previous ? dateOnly(previous.assessedOn) : null];
  for (const date of dates) {
    if (!date) continue;
    if (date < dateOnly(progress.startDate))
      throw badRequest("Peça à coordenação a correção de notas anteriores a este vínculo.");
    await assertAssessmentDateAccess(context, { progress, date: new Date(date) });
  }
}
function mergedGrades(progress: Progress, changes: GradeInput[]): GradeInput[] {
  const grades = new Map<string, GradeInput>();
  for (const grade of progress.assessment?.grades ?? [])
    grades.set(`${grade.phase}/${grade.competence}`, {
      phase: grade.phase,
      competence: grade.competence,
      score: Number(grade.score),
      assessedOn: dateOnly(grade.assessedOn),
      reason: grade.reason,
    });
  for (const grade of changes) grades.set(`${grade.phase}/${grade.competence}`, grade);
  return [...grades.values()].filter((grade) => grade.score !== null);
}
function assertGradeSequence(grades: GradeInput[]): void {
  for (const competence of ACADEMIC_COMPETENCES) {
    const own = grades.filter((grade) => grade.competence === competence);
    const first = own.find((grade) => grade.phase === "BLOCK_ONE");
    const second = own.find((grade) => grade.phase === "BLOCK_TWO");
    const recovery = own.find((grade) => grade.phase === "RECOVERY");
    if (first?.assessedOn && second?.assessedOn && second.assessedOn < first.assessedOn)
      throw badRequest("A segunda unidade não pode ter data anterior à primeira.");
    if (recovery && (!first || !second))
      throw badRequest("Registre as duas unidades da competência antes da recuperação.");
    if (recovery?.assessedOn && second?.assessedOn && recovery.assessedOn < second.assessedOn)
      throw badRequest("A recuperação não pode ter data anterior às duas unidades.");
  }
}
