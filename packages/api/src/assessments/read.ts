import {
  assessmentResults,
  assessmentStatus,
  saoPauloDateOnly,
  type AcademicGrade,
} from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { notFound } from "../trpc/errors.js";
import { assessmentObservations } from "./observations.js";
import {
  assertProgressAccess,
  assertTeacherAccess,
  dateOnly,
  loadProgress,
  progressInclude,
  type Progress,
  type AssessmentContext,
} from "./data.js";

export type AssessmentView = {
  progressId: string;
  fileScope: { enrollmentId: string; from: string; through: string | null };
  assessmentId: string | null;
  version: number;
  observations?: ReturnType<typeof assessmentObservations>;
  student: Progress["enrollment"]["student"];
  class: { id: string; name: string };
  stage: Progress["stage"];
  startedOn: string;
  endedOn: string | null;
  current: boolean;
  grades: Array<
    AcademicGrade & {
      assessedOn: string;
      reason: string | null;
      recordedBy: string;
      updatedAt: Date;
    }
  >;
  results: ReturnType<typeof assessmentResults>;
  status: ReturnType<typeof assessmentStatus>;
  decision: NonNullable<Progress["assessment"]>["decision"];
  decisionReason: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  canConfirm: boolean;
  today: string;
};
export function assessmentView(progress: Progress, context: AssessmentContext): AssessmentView {
  const assessment = progress.assessment;
  const grades =
    assessment?.grades.map((grade) => ({
      phase: grade.phase,
      competence: grade.competence,
      score: Number(grade.score),
      assessedOn: dateOnly(grade.assessedOn),
      reason: grade.reason,
      recordedBy: grade.recordedBy.name,
      updatedAt: grade.updatedAt,
    })) ?? [];
  const results = assessmentResults(grades);
  const today = saoPauloDateOnly(context.now);
  return {
    progressId: progress.id,
    fileScope: {
      enrollmentId: progress.enrollmentId,
      from: dateOnly(progress.startDate),
      through: progress.endDate ? dateOnly(progress.endDate) : null,
    },
    assessmentId: assessment?.id ?? null,
    version: assessment?.version ?? 0,
    observations: assessmentObservations(progress),
    student: progress.enrollment.student,
    class: { id: progress.enrollment.classId, name: progress.enrollment.class.portalClassName },
    stage: progress.stage,
    startedOn: dateOnly(assessment?.startedOn ?? progress.startDate),
    endedOn: progress.endDate ? dateOnly(progress.endDate) : null,
    current:
      dateOnly(progress.startDate) <= today &&
      (!progress.endDate || dateOnly(progress.endDate) >= today) &&
      (!progress.enrollment.exitDate || dateOnly(progress.enrollment.exitDate) > today),
    grades,
    results,
    status: assessmentStatus(results),
    decision: assessment?.decision ?? null,
    decisionReason: assessment?.decisionReason ?? null,
    confirmedAt: assessment?.confirmedAt ?? null,
    confirmedBy: assessment?.confirmedBy?.name ?? null,
    canConfirm: context.staffUser.role !== "TEACHER",
    today,
  };
}
export async function readAssessment(
  context: AssessmentContext,
  id: string,
): Promise<AssessmentView> {
  const progress = await loadProgress(context.database, id);
  await assertProgressAccess(context, progress);
  return assessmentView(progress, context);
}
export async function readStudentAssessments(
  context: AssessmentContext,
  studentId: string,
): Promise<AssessmentView[]> {
  const student = await context.database.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  const progress = await context.database.pedagogicalProgress.findMany({
    where: {
      deletedAt: null,
      startDate: { lte: new Date(saoPauloDateOnly(context.now)) },
      enrollment: { studentId, deletedAt: null },
    },
    include: progressInclude,
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
  });
  const seen = new Set<string>();
  const visible = await Promise.all(
    progress.map(async (row) => {
      try {
        await assertProgressAccess(context, row);
        return row;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "FORBIDDEN") return null;
        throw error;
      }
    }),
  );
  return visible.flatMap((row) => {
    if (!row) return [];
    const key = row.assessmentId ?? row.id;
    if (seen.has(key)) return [];
    seen.add(key);
    return [assessmentView(row, context)];
  });
}
export async function readClassAssessments(
  context: AssessmentContext,
  classId: string,
): Promise<AssessmentView[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const classRow = await context.database.class.findFirst({
    where: { id: classId, deletedAt: null },
    select: {
      ...responsibilitySelect,
      substitutions: {
        where: { teacherId: context.staffUser.id, date: today, revokedAt: null, deletedAt: null },
        select: { id: true },
      },
    },
  });
  if (!classRow) throw notFound("Turma não encontrada.");
  if (classRow.substitutions.length === 0)
    assertTeacherAccess(context.staffUser, { classRow, date: today });
  const progress = await context.database.pedagogicalProgress.findMany({
    where: {
      deletedAt: null,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      enrollment: {
        classId,
        deletedAt: null,
        entryDate: { lte: today },
        OR: [{ exitDate: null }, { exitDate: { gt: today } }],
      },
    },
    include: progressInclude,
    orderBy: { enrollment: { student: { fullName: "asc" } } },
  });
  return progress.map((row) => assessmentView(row, context));
}
export async function assessmentClasses(
  context: AssessmentContext,
): Promise<Array<{ id: string; name: string; semester: string }>> {
  const today = new Date(saoPauloDateOnly(context.now));
  const rows = await context.database.class.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      portalClassName: true,
      semester: { select: { name: true } },
      ...responsibilitySelect,
      substitutions: {
        where: { teacherId: context.staffUser.id, date: today, revokedAt: null, deletedAt: null },
        select: { id: true },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
  return rows
    .filter(
      (row) =>
        context.staffUser.role !== "TEACHER" ||
        usualTeacherOn(row, today)?.id === context.staffUser.id ||
        row.substitutions.length > 0,
    )
    .map((row) => ({ id: row.id, name: row.portalClassName, semester: row.semester.name }));
}
