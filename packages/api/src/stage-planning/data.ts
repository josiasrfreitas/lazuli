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
export const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);
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
export async function loadPlanningScope(
  context: PlanningContext,
  target: StagePlanTarget,
  lock = false,
): Promise<PlanningScope> {
  const classRow = await context.database.class.findFirst({
    where: { id: target.classId, deletedAt: null },
    select: classInclude,
  });
  if (!classRow) throw notFound("Turma não encontrada.");
  const today = saoPauloDateOnly(context.now);
  if (
    context.staffUser.role === "TEACHER" &&
    usualTeacherOn(classRow, new Date(today))?.id !== context.staffUser.id
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Planejamento disponível apenas para o professor responsável pela turma.",
    });
  const progress = target.progressId
    ? await context.database.pedagogicalProgress.findFirst({
        where: {
          id: target.progressId,
          deletedAt: null,
          enrollment: { classId: classRow.id, deletedAt: null, student: { deletedAt: null } },
        },
        include: {
          stage: { select: stageSelect },
          enrollment: {
            select: {
              entryDate: true,
              exitDate: true,
              student: { select: { id: true, fullName: true } },
            },
          },
        },
      })
    : null;
  if (classRow.scheduleType === "PERSONALIZED" && !progress)
    throw notFound("Selecione o percurso de um aluno desta turma PPT.");
  if (classRow.scheduleType === "REGULAR" && target.progressId)
    throw badRequest("O planejamento regular é compartilhado pela turma.");
  const stage = progress?.stage ?? classRow.sharedStage;
  if (!stage) throw notFound("Estágio não encontrado.");
  if (lock) {
    if (progress) await lockStudentEnrollment(context.database, progress.enrollment.student.id);
    else {
      const key = `stage-plan-class:${classRow.id}`;
      await context.database
        .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
    }
    // Enrollment transfer and planning use the same student lock. Re-read after acquiring it.
    return loadPlanningScope(context, target);
  }
  const ended =
    progress &&
    ((progress.endDate && dateOnly(progress.endDate) < today) ||
      (progress.enrollment.exitDate && dateOnly(progress.enrollment.exitDate) <= today));
  if (
    context.staffUser.role === "TEACHER" &&
    progress?.enrollment.exitDate &&
    dateOnly(progress.enrollment.exitDate) <= today
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este aluno já não possui vínculo vigente nesta turma.",
    });
  return {
    class: { id: classRow.id, name: classRow.portalClassName, scheduleType: classRow.scheduleType },
    semester: {
      name: classRow.semester.name,
      startOn: dateOnly(classRow.semester.startDate),
      endOn: dateOnly(classRow.semester.endDate),
    },
    stage,
    student: progress?.enrollment.student ?? null,
    progressId: progress?.id ?? null,
    planId: progress?.stagePlanId ?? null,
    progressStartOn: progress ? dateOnly(progress.startDate) : null,
    readOnly:
      classRow.status !== "ACTIVE" ||
      Boolean(ended) ||
      (!progress && dateOnly(classRow.semester.endDate) < today),
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
export function planSnapshot(plan: Plan) {
  return {
    plannedStartOn: dateOnly(plan.plannedStartOn),
    plannedEndOn: dateOnly(plan.plannedEndOn),
    objective: plan.objective,
    items: plan.items.map((item) => ({
      id: item.id,
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
    throw badRequest(
      "Este contexto está encerrado. O planejamento permanece disponível no histórico.",
    );
}
export function assertVersion(plan: Plan | null, version: number): void {
  if ((plan?.version ?? 0) !== version)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O planejamento mudou. Atualize a página antes de salvar novamente.",
    });
}
