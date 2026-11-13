import { programSchedule, persistProgramSchedule } from "./program-schedule.js";
import { resolvePlannedProgramActivity } from "./program-activity.js";
import type { VersionedResult } from "../class-records/types.js";
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
async function editablePlan(
  context: PlanningContext,
  input: { target: StagePlanTarget; version: number },
): Promise<{ scope: PlanningScope; plan: Plan | null }> {
  const { target, version } = input;
  const scope = await loadPlanningScope(context, { ...target, lock: true });
  assertEditable(scope);
  const plan = await loadPlan(context, scope);
  assertVersion(plan, version);
  return { scope, plan };
}
export async function savePlanWindow(
  context: PlanningContext,
  input: StagePlanWindow,
): Promise<VersionedResult> {
  const { scope, plan } = await editablePlan(context, { target: input, version: input.version });
  input = { ...input, plannedEndOn: scope.semester.endOn };
  if (input.plannedStartOn < scope.semester.startOn || input.plannedStartOn > scope.semester.endOn)
    throw badRequest("O início deve ficar dentro do semestre da turma.");
  const canonical = !plan || plan.items.some((item) => item.programActivityId);
  const rows = canonical ? await programSchedule(context, scope, input.plannedStartOn, plan) : null;
  if (!rows) assertWindowBounds(scope, { plan, input });
  const data = {
    plannedStartOn: new Date(input.plannedStartOn),
    plannedEndOn: new Date(input.plannedEndOn),
    objective: input.objective || null,
  };
  if (plan) {
    await bumpVersion(context, plan);
    await context.database.stagePlan.update({ where: { id: plan.id }, data });
    if (rows) await persistProgramSchedule(context, plan.id, rows, plan);
    return recordRevision(context, { scope, planId: plan.id, reason: input.reason! });
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
  if (rows) await persistProgramSchedule(context, created.id, rows, null);
  if (scope.progressId)
    await context.database.pedagogicalProgress.update({
      where: { id: scope.progressId },
      data: { stagePlanId: created.id },
    });
  return recordRevision(context, { scope, planId: created.id, reason: "Planejamento inicial." });
}
export async function savePlanItem(
  context: PlanningContext,
  input: StagePlanItemInput,
): Promise<VersionedResult> {
  const { scope, plan } = await editablePlan(context, { target: input, version: input.version });
  if (!plan) throw notFound("Crie o planejamento antes de incluir atividades.");
  const previous = assertPlannedItem({ plan, input });
  const program = await plannedProgramContent(context, { scope, input, previous });
  await bumpVersion(context, plan);
  const data = {
    programActivityId: program.id,
    plannedOn: new Date(input.plannedOn),
    ...plannedText(program.content, input),
    pageFrom: input.pageFrom,
    pageTo: input.pageTo,
  };
  await (input.itemId
    ? context.database.stagePlanItem.update({ where: { id: input.itemId }, data })
    : context.database.stagePlanItem.create({ data: { ...data, planId: plan.id } }));
  return recordRevision(context, {
    scope,
    planId: plan.id,
    reason: previous
      ? `Atividade revisada: ${previous.title}. ${input.reason}`
      : `Atividade incluída: ${input.title}.${input.reason ? ` ${input.reason}` : ""}`,
  });
}
export async function removePlanItem(
  context: PlanningContext,
  input: StagePlanRemove,
): Promise<VersionedResult> {
  const { scope, plan } = await editablePlan(context, { target: input, version: input.version });
  const item = plan?.items.find((row) => row.id === input.itemId);
  if (!plan || !item) throw notFound("Atividade não encontrada neste plano.");
  await bumpVersion(context, plan);
  await context.database.stagePlanItem.update({
    where: { id: input.itemId },
    data: { deletedAt: context.now },
  });
  return recordRevision(context, {
    scope,
    planId: plan.id,
    reason: `Atividade retirada: ${item.title}. ${input.reason}`,
  });
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
  input: { scope: PlanningScope; planId: string; reason: string },
): Promise<VersionedResult> {
  const { scope, planId, reason } = input;
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
  await recordActivity(context.database, {
    context,
    action: plan.version === 1 ? "planning.create" : "planning.revise",
    details: {
      subject: scope.student
        ? { type: "student", id: scope.student.id, name: scope.student.fullName }
        : { type: "class", id: scope.class.id, name: scope.class.name },
      description: `${scope.stage.name} · versão ${plan.version}. ${reason}`,
    },
  });
  return { id: plan.id, version: plan.version };
}

function assertWindowBounds(
  scope: PlanningScope,
  values: { plan: Plan | null; input: StagePlanWindow },
): void {
  const { plan, input } = values;
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
}

function assertPlannedItem(values: {
  plan: Plan;
  input: StagePlanItemInput;
}): Plan["items"][number] | null {
  const { plan, input } = values;
  if (
    input.plannedOn < dateOnly(plan.plannedStartOn) ||
    input.plannedOn > dateOnly(plan.plannedEndOn)
  )
    throw badRequest("A data da atividade deve ficar dentro do período planejado.");
  const previous = input.itemId ? plan.items.find((item) => item.id === input.itemId) : null;
  if (input.itemId && !previous) throw notFound("Atividade não encontrada neste plano.");
  if (!input.itemId && plan.items.length >= MAX_PLAN_ITEMS)
    throw badRequest("Este plano já possui 500 atividades.");
  return previous ?? null;
}

async function plannedProgramContent(
  context: PlanningContext,
  {
    scope,
    input,
    previous,
  }: { scope: PlanningScope; input: StagePlanItemInput; previous: Plan["items"][number] | null },
): Promise<{
  id: string | null;
  content: Awaited<ReturnType<typeof resolvePlannedProgramActivity>> | null;
}> {
  const id =
    input.programActivityId === undefined
      ? (previous?.programActivityId ?? null)
      : input.programActivityId;
  const content = id
    ? await resolvePlannedProgramActivity(context, {
        scope,
        id,
        previousId: previous?.programActivityId ?? null,
      })
    : null;
  return { id, content };
}

function plannedText(
  content: Awaited<ReturnType<typeof resolvePlannedProgramActivity>> | null,
  input: StagePlanItemInput,
): { kind: StagePlanItemInput["kind"]; title: string; reference: string | null } {
  if (content) return content;
  return { kind: input.kind, title: input.title, reference: input.reference || null };
}

export async function prepareProgramPlan(
  context: PlanningContext,
  target: StagePlanTarget,
): Promise<void> {
  const scope = await loadPlanningScope(context, { ...target, lock: true });
  if (scope.readOnly || (await loadPlan(context, scope))) return;
  if (!(await programSchedule(context, scope, scope.progressStartOn ?? scope.classStartOn, null)))
    throw badRequest("A programação deste estágio ainda não foi importada.");
  await savePlanWindow(context, {
    ...target,
    version: 0,
    plannedStartOn: scope.progressStartOn ?? scope.classStartOn,
    plannedEndOn: scope.semester.endOn,
    objective: null,
  });
}

/** Product entry point: new schedules require an imported curriculum. */
export async function saveProgramStart(
  context: PlanningContext,
  input: StagePlanWindow,
): Promise<VersionedResult> {
  const { scope, plan } = await editablePlan(context, { target: input, version: input.version });
  if (!plan && !(await programSchedule(context, scope, input.plannedStartOn, null)))
    throw badRequest("A programação deste estágio ainda não foi importada.");
  return savePlanWindow(context, input);
}
