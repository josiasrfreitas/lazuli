import type { TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { calendarDateSchema, z } from "@lazuli/validators";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockTeacher } from "../teachers/availability.js";
import {
  assertVersion,
  lockSemester,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";
import { withdrawPlacement } from "./publish.js";

const reason = "Início da turma adiado.";
export const postponeSchema = z
  .object({
    planId: z.string().uuid(),
    version: z.number().int().positive(),
    startsOn: calendarDateSchema,
  })
  .strict();

export async function postponeClass(
  context: OrganizationContext,
  input: z.infer<typeof postponeSchema>,
): Promise<{ requestId: string | null }> {
  const db = context.database;
  const initial = await db.semesterClassPlan.findFirst({
    where: { id: input.planId, deletedAt: null },
    select: { semesterId: true },
  });
  if (!initial) throw notFound("Turma não encontrada.");
  const period = await lockSemester(context, initial.semesterId);
  await lockTeacher(db, "");
  const plan = await db.semesterClassPlan.findUniqueOrThrow({
    where: { id: input.planId },
    include: { class: { select: { startDate: true } } },
  });
  assertVersion(plan.version, input.version);
  const previous = plan.startsOn ?? plan.class?.startDate ?? period.startDate;
  const start = new Date(input.startsOn);
  const today = saoPauloDateOnly(context.now);
  assertStartDate({ start, previous, today: new Date(today), period, closedAt: plan.closedAt });
  if (plan.classId)
    await assertPostponable(db, { classId: plan.classId, planId: plan.id, start, today });
  await reschedulePlaces(context, { planId: plan.id, start });
  await db.semesterClassPlan.update({
    where: { id: plan.id },
    data: { startsOn: start, version: { increment: 1 } },
  });
  if (!plan.classId) return { requestId: null };
  await db.class.update({ where: { id: plan.classId }, data: { startDate: start } });
  const request = await db.calendarReconciliationRequest.create({
    data: {
      semesterId: period.id,
      fromDate: previous,
      throughDate: start,
      reason,
      requestedById: context.staffUser.id,
    },
  });
  return { requestId: request.id };
}

async function assertPostponable(
  db: TransactionClient,
  {
    classId,
    planId,
    start,
    today,
  }: { classId: string; planId: string; start: Date; today: string },
): Promise<void> {
  const started = await db.enrollment.count({
    where: { classId: classId, deletedAt: null, entryDate: { lte: new Date(today) } },
  });
  if (started)
    throw badRequest("Esta turma já recebeu alunos. Revise os horários no cadastro da turma.");
  const separate = await db.enrollment.count({
    where: {
      classId: classId,
      deletedAt: null,
      entryDate: { lt: start },
      futureSemesterPlacements: { none: { planId: planId, deletedAt: null } },
    },
  });
  if (separate)
    throw badRequest("Revise as entradas agendadas pelo cadastro da turma antes de adiar.");
}
async function reschedulePlaces(
  context: OrganizationContext,
  { planId, start }: { planId: string; start: Date },
): Promise<void> {
  const db = context.database;
  const affected = await db.semesterPlacement.findMany({
    where: {
      planId: planId,
      deletedAt: null,
      declinedAt: null,
      OR: [{ effectiveDate: null }, { effectiveDate: { lt: start } }],
    },
    orderBy: { studentId: "asc" },
  });
  for (const row of affected) {
    if (row.publishedAt)
      await withdrawPlacement(context, { id: row.id, version: row.version, reason });
    await db.semesterPlacement.update({
      where: { id: row.id },
      data: {
        effectiveDate: start,
        version: { increment: 1 },
        ...(row.continuity === "STAY" ? { continuity: "UNDECIDED", continuityReason: null } : {}),
      },
    });
    await recordPlacementRevision(context, { id: row.id, action: "POSTPONED", reason });
  }
}

function assertStartDate({
  start,
  previous,
  today,
  period,
  closedAt,
}: {
  start: Date;
  previous: Date;
  today: Date;
  period: { startDate: Date; endDate: Date };
  closedAt: Date | null;
}): void {
  if (
    closedAt ||
    start <= today ||
    start <= previous ||
    start > period.endDate ||
    start < period.startDate
  )
    throw badRequest("Escolha uma data futura, depois do início atual e dentro do período.");
}
