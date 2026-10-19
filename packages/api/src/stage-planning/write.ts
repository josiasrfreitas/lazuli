import { resolvePlannedProgramActivity } from "./program-activity.js";
import type {
  StagePlanWindow,
  StagePlanItemInput,
  StagePlanRemove,
  StagePlanTarget,
} from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { badRequest, notFound } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import {
  loadPlanningScope,
  loadPlan,
  planSnapshot,
  assertEditable,
  assertVersion,
  planInclude,
  dateOnly,
  type PlanningContext,
  type PlanningScope,
  type Plan,
} from "./data.js";
const MAX_PLAN_ITEMS = 500;
async function editablePlan(context: PlanningContext, target: StagePlanTarget, version: number) {
  const scope = await loadPlanningScope(context, target, true);
  assertEditable(scope);
  const plan = await loadPlan(context, scope);
  assertVersion(plan, version);
  return { scope, plan };
}
export async function savePlanWindow(context: PlanningContext, input: StagePlanWindow) {
  const { scope, plan } = await editablePlan(context, input, input.version);
  if (
    !scope.student &&
    (input.plannedStartOn < scope.semester.startOn || input.plannedEndOn > scope.semester.endOn)
  )
    throw badRequest("O plano regular deve ficar dentro do semestre da turma.");
  if (
    plan?.items.some(
      (item) =>
        dateOnly(item.plannedOn) < input.plannedStartOn ||
        dateOnly(item.plannedOn) > input.plannedEndOn,
    )
  )
    throw badRequest(
      "Existem atividades fora do novo período. Reorganize essas datas antes de reduzir o prazo.",
    );
  const data = {
    plannedStartOn: new Date(input.plannedStartOn),
    plannedEndOn: new Date(input.plannedEndOn),
    objective: input.objective || null,
  };
  if (plan) {
    await bumpVersion(context, plan);
    await context.database.stagePlan.update({ where: { id: plan.id }, data });
    return recordRevision(context, scope, plan.id, input.reason!);
  }
  const created = await context.database.stagePlan.create({
    data: {
      ...data,
      classId: scope.student ? null : scope.class.id,
      studentId: scope.student?.id ?? null,
      stageId: scope.stage.id,
      createdById: context.staffUser.id,
    },
  });
  if (scope.progressId)
    await context.database.pedagogicalProgress.update({
      where: { id: scope.progressId },
      data: { stagePlanId: created.id },
    });
  return recordRevision(context, scope, created.id, "Planejamento inicial.");
}
export async function savePlanItem(context: PlanningContext, input: StagePlanItemInput) {
  const { scope, plan } = await editablePlan(context, input, input.version);
  if (!plan) throw notFound("Crie o planejamento antes de incluir atividades.");
  if (
    input.plannedOn < dateOnly(plan.plannedStartOn) ||
    input.plannedOn > dateOnly(plan.plannedEndOn)
  )
    throw badRequest("A data da atividade deve ficar dentro do período planejado.");
  const previous = input.itemId ? plan.items.find((item) => item.id === input.itemId) : null;
  if (input.itemId && !previous) throw notFound("Atividade não encontrada neste plano.");
  if (!input.itemId && plan.items.length >= MAX_PLAN_ITEMS)
    throw badRequest("Este plano já possui 500 atividades.");
  const programActivityId =
    input.programActivityId === undefined
      ? (previous?.programActivityId ?? null)
      : input.programActivityId;
  const programContent = programActivityId
    ? await resolvePlannedProgramActivity(
        context,
        scope,
        programActivityId,
        previous?.programActivityId ?? null,
      )
    : null;
  await bumpVersion(context, plan);
  const data = {
    programActivityId,
    plannedOn: new Date(input.plannedOn),
    kind: programContent?.kind ?? input.kind,
    title: programContent?.title ?? input.title,
    reference: programContent?.reference ?? (input.reference || null),
    pageFrom: input.pageFrom,
    pageTo: input.pageTo,
  };
  if (input.itemId)
    await context.database.stagePlanItem.update({ where: { id: input.itemId }, data });
  else await context.database.stagePlanItem.create({ data: { ...data, planId: plan.id } });
  return recordRevision(
    context,
    scope,
    plan.id,
    previous
      ? `Atividade revisada: ${previous.title}. ${input.reason}`
      : `Atividade incluída: ${input.title}.${input.reason ? ` ${input.reason}` : ""}`,
  );
}
export async function removePlanItem(context: PlanningContext, input: StagePlanRemove) {
  const { scope, plan } = await editablePlan(context, input, input.version);
  const item = plan?.items.find((row) => row.id === input.itemId);
  if (!plan || !item) throw notFound("Atividade não encontrada neste plano.");
  await bumpVersion(context, plan);
  await context.database.stagePlanItem.update({
    where: { id: input.itemId },
    data: { deletedAt: context.now },
  });
  return recordRevision(
    context,
    scope,
    plan.id,
    `Atividade retirada: ${item.title}. ${input.reason}`,
  );
}
async function bumpVersion(context: PlanningContext, plan: Plan): Promise<void> {
  const result = await context.database.stagePlan.updateMany({
    where: { id: plan.id, version: plan.version },
    data: { version: { increment: 1 } },
  });
  if (result.count !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O planejamento mudou. Atualize a página antes de salvar novamente.",
    });
}
async function recordRevision(
  context: PlanningContext,
  scope: PlanningScope,
  planId: string,
  reason: string,
) {
  const plan = await context.database.stagePlan.findUniqueOrThrow({
    where: { id: planId },
    include: planInclude,
  });
  await context.database.stagePlanRevision.create({
    data: {
      planId,
      version: plan.version,
      reason,
      snapshot: planSnapshot(plan),
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(
    context.database,
    context,
    plan.version === 1 ? "planning.create" : "planning.revise",
    {
      subject: scope.student
        ? { type: "student", id: scope.student.id, name: scope.student.fullName }
        : { type: "class", id: scope.class.id, name: scope.class.name },
      description: `${scope.stage.name} · versão ${plan.version}. ${reason}`,
    },
  );
  return { id: plan.id, version: plan.version };
}
