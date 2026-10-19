import type { PlanSnapshot } from "./types.js";
import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import type { StagePlanTarget } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly } from "@lazuli/domain";
import { notFound, badRequest } from "../trpc/errors.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { lockStudentEnrollment } from "../enrollment/data.js";
export type PlanningContext = {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  now: Date;
};
const DATE_ONLY_LENGTH = 10;
export const dateOnly = (date: Date): string => date.toISOString().slice(0, DATE_ONLY_LENGTH);
export const stageSelect = { id: true, name: true, track: { select: { name: true } } } as const;
const classInclude = {
  ...responsibilitySelect,
  id: true,
  portalClassName: true,
  status: true,
  scheduleType: true,
  sharedStage: { select: stageSelect },
  semester: { select: { id: true, name: true, startDate: true, endDate: true } },
} satisfies Prisma.ClassSelect;
export const planInclude = {
  items: {
    where: { deletedAt: null },
    orderBy: [{ plannedOn: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.StagePlanInclude;
export type Plan = Prisma.StagePlanGetPayload<{ include: typeof planInclude }>;

export type PlanningScope = {
  class: { id: string; name: string; scheduleType: "REGULAR" | "PERSONALIZED" };
  semester: { name: string; startOn: string; endOn: string };
  stage: { id: string; name: string; track: { name: string } };
  student: { id: string; fullName: string } | null;
  progressId: string | null;
  planId: string | null;
  progressStartOn: string | null;
  readOnly: boolean;
  today: string;
};
const progressInclude = {
  stage: { select: stageSelect },
  enrollment: {
    select: { entryDate: true, exitDate: true, student: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.PedagogicalProgressInclude;
type PlanningClass = Prisma.ClassGetPayload<{ select: typeof classInclude }>;
type PlanningProgress = Prisma.PedagogicalProgressGetPayload<{ include: typeof progressInclude }>;

export async function loadPlanningScope(
  context: PlanningContext,
  target: StagePlanTarget & { lock?: boolean },
): Promise<PlanningScope> {
  const classRow = await context.database.class.findFirst({
    where: { id: target.classId, deletedAt: null },
    select: classInclude,
  });
  if (!classRow) throw notFound("Turma não encontrada.");
  const today = saoPauloDateOnly(context.now);
  const substituteOnly = await assertTeacherAccess(context, { classRow, today });
  const progress = await loadProgress(context, { classRow, progressId: target.progressId });
  if (target.lock) {
    await lockScope(context, { classRow, progress });
    return loadPlanningScope(context, {
      classId: target.classId,
      ...(target.progressId ? { progressId: target.progressId } : {}),
    });
  }
  assertReadableEnrollment(context, { progress, today });
  return scopeFor({ classRow, progress, today, substituteOnly });
}
async function assertTeacherAccess(
  context: PlanningContext,
  input: { classRow: PlanningClass; today: string },
): Promise<boolean> {
  if (
    context.staffUser.role !== "TEACHER" ||
    usualTeacherOn(input.classRow, new Date(input.today))?.id === context.staffUser.id
  )
    return false;
  const assignment = await context.database.classSubstitution.findFirst({
    where: {
      classId: input.classRow.id,
      teacherId: context.staffUser.id,
      date: { gte: new Date(input.today) },
      revokedAt: null,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!assignment)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Planejamento disponível apenas para os professores atribuídos à turma.",
    });
  return true;
}
async function loadProgress(
  context: PlanningContext,
  input: { classRow: PlanningClass; progressId: string | undefined },
): Promise<PlanningProgress | null> {
  if (input.classRow.scheduleType === "REGULAR") {
    if (input.progressId) throw badRequest("O planejamento regular é compartilhado pela turma.");
    return null;
  }
  if (!input.progressId) throw notFound("Selecione o percurso de um aluno desta turma PPT.");
  const progress = await context.database.pedagogicalProgress.findFirst({
    where: {
      id: input.progressId,
      deletedAt: null,
      enrollment: { classId: input.classRow.id, deletedAt: null, student: { deletedAt: null } },
    },
    include: progressInclude,
  });
  if (!progress) throw notFound("Selecione o percurso de um aluno desta turma PPT.");
  return progress;
}
async function lockScope(
  context: PlanningContext,
  input: { classRow: PlanningClass; progress: PlanningProgress | null },
): Promise<void> {
  if (input.progress)
    await lockStudentEnrollment(context.database, input.progress.enrollment.student.id);
  else {
    const key = `stage-plan-class:${input.classRow.id}`;
    await context.database
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
  }
}
function assertReadableEnrollment(
  context: PlanningContext,
  input: { progress: PlanningProgress | null; today: string },
): void {
  if (
    context.staffUser.role === "TEACHER" &&
    input.progress?.enrollment.exitDate &&
    dateOnly(input.progress.enrollment.exitDate) <= input.today
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este aluno já não possui vínculo vigente nesta turma.",
    });
}
function progressEnded(progress: PlanningProgress, today: string): boolean {
  return Boolean(
    (progress.endDate && dateOnly(progress.endDate) <= today) ||
    (progress.enrollment.exitDate && dateOnly(progress.enrollment.exitDate) <= today),
  );
}
function scopeFor(input: {
  classRow: PlanningClass;
  progress: PlanningProgress | null;
  today: string;
  substituteOnly: boolean;
}): PlanningScope {
  const { classRow, progress, today, substituteOnly } = input;
  const stage = progress?.stage ?? classRow.sharedStage;
  if (!stage) throw notFound("Estágio não encontrado.");
  const historical = progress
    ? progressEnded(progress, today)
    : dateOnly(classRow.semester.endDate) < today;
  return {
    class: { id: classRow.id, name: classRow.portalClassName, scheduleType: classRow.scheduleType },
    semester: {
      name: classRow.semester.name,
      startOn: dateOnly(classRow.semester.startDate),
      endOn: dateOnly(classRow.semester.endDate),
    },
    stage,
    ...progressContext(progress),
    readOnly: substituteOnly || classRow.status !== "ACTIVE" || historical,
    today,
  };
}
export async function loadPlan(
  context: PlanningContext,
  scope: PlanningScope,
): Promise<Plan | null> {
  if (scope.student && !scope.planId) return null;
  return context.database.stagePlan.findFirst({
    where: {
      deletedAt: null,
      stageId: scope.stage.id,
      ...(scope.student
        ? { id: scope.planId!, studentId: scope.student.id }
        : { classId: scope.class.id }),
    },
    include: planInclude,
  });
}
export function planSnapshot(plan: Plan): PlanSnapshot {
  return {
    plannedStartOn: dateOnly(plan.plannedStartOn),
    plannedEndOn: dateOnly(plan.plannedEndOn),
    objective: plan.objective,
    items: plan.items.map((item) => ({
      id: item.id,
      programActivityId: item.programActivityId,
      plannedOn: dateOnly(item.plannedOn),
      kind: item.kind,
      title: item.title,
      reference: item.reference,
      pageFrom: item.pageFrom,
      pageTo: item.pageTo,
    })),
  };
}
export function assertEditable(scope: PlanningScope): void {
  if (scope.readOnly)
    throw badRequest("Este planejamento está disponível somente para consulta neste contexto.");
}
export function assertVersion(plan: Plan | null, version: number): void {
  if ((plan?.version ?? 0) !== version)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O planejamento mudou. Atualize a página antes de salvar novamente.",
    });
}

function progressContext(
  progress: PlanningProgress | null,
): Pick<PlanningScope, "student" | "progressId" | "planId" | "progressStartOn"> {
  return {
    student: progress?.enrollment.student ?? null,
    progressId: progress?.id ?? null,
    planId: progress?.stagePlanId ?? null,
    progressStartOn: progress ? dateOnly(progress.startDate) : null,
  };
}
