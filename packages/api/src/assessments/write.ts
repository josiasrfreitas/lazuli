import { assessmentResults, assessmentStatus } from "@lazuli/domain";
import type { AssessmentSave, AssessmentConfirm } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { lockProgress, type AssessmentContext, type Progress } from "./data.js";
import { readAssessment, type AssessmentView } from "./read.js";
import { assertGradeChanges, gradeChanges } from "./rules.js";
import { recordAssessmentChanges } from "./activity.js";
import { recordActivity } from "../activity/record.js";

export async function saveAssessment(
  context: AssessmentContext,
  values: AssessmentSave,
): Promise<AssessmentView> {
  const progress = await lockProgress(context, values.progressId);
  const changes = gradeChanges(progress, values);
  assertGradeChanges(context, progress, values, changes);
  if (changes.length === 0) return readAssessment(context, progress.id);
  const id = await ensureAssessment(context, progress);
  for (const grade of changes) await writeGrade(context, id, grade, values.correctionReason);
  await context.database.stageAssessment.update({
    where: { id },
    data: {
      version: values.version + 1,
      decision: null,
      decisionReason: null,
      confirmedAt: null,
      confirmedById: null,
    },
  });
  await recordAssessmentChanges(context, progress, values, changes);
  return readAssessment(context, progress.id);
}
async function ensureAssessment(context: AssessmentContext, progress: Progress): Promise<string> {
  if (progress.assessmentId) return progress.assessmentId;
  const created = await context.database.stageAssessment.create({
    data: {
      studentId: progress.enrollment.studentId,
      stageId: progress.stageId,
      startedOn: progress.startDate,
      createdById: context.staffUser.id,
      progressRecords: { connect: { id: progress.id } },
    },
  });
  return created.id;
}
async function writeGrade(
  context: AssessmentContext,
  assessmentId: string,
  grade: AssessmentSave["grades"][number],
  correctionReason?: string,
): Promise<void> {
  const { database, staffUser, now } = context;
  const where = { assessmentId, phase: grade.phase, competence: grade.competence };
  const reason = grade.phase === "RECOVERY" ? grade.reason : correctionReason || null;
  if (grade.score === null) {
    await database.assessmentGrade.updateMany({
      where: { ...where, deletedAt: null },
      data: { deletedAt: now, reason, recordedById: staffUser.id },
    });
    return;
  }
  const data = {
    score: grade.score,
    assessedOn: new Date(grade.assessedOn!),
    reason,
    recordedById: staffUser.id,
    deletedAt: null,
  };
  await database.assessmentGrade.upsert({
    where: { assessmentId_phase_competence: where },
    create: { ...where, ...data },
    update: data,
  });
}
export async function confirmAssessment(
  context: AssessmentContext,
  values: AssessmentConfirm,
): Promise<AssessmentView> {
  const progress = await lockProgress(context, values.progressId);
  const assessment = progress.assessment;
  if (!assessment || assessment.version !== values.version)
    throw badRequest("As notas foram alteradas. Atualize a página antes de confirmar.");
  const status = assessmentStatus(
    assessmentResults(assessment.grades.map((grade) => ({ ...grade, score: Number(grade.score) }))),
  );
  if (status === "INCOMPLETE")
    throw badRequest(
      "Complete as duas unidades de todas as competências antes de concluir a avaliação.",
    );
  if (values.decision === "APPROVED" && status !== "SUFFICIENT")
    throw badRequest("A aprovação exige pelo menos 60 em todas as competências.");
  await context.database.stageAssessment.update({
    where: { id: assessment.id },
    data: {
      version: { increment: 1 },
      decision: values.decision,
      decisionReason: values.reason,
      confirmedAt: context.now,
      confirmedById: context.staffUser.id,
    },
  });
  await recordActivity(context.database, context, "assessments.confirm", {
    subject: {
      type: "student",
      id: progress.enrollment.studentId,
      name: `${progress.enrollment.student.fullName} · ${progress.stage.name}`,
    },
    description: `${values.decision === "APPROVED" ? "Aprovação" : "Repetência"} confirmada. ${values.reason}`,
  });
  return readAssessment(context, progress.id);
}
