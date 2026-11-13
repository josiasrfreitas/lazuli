import { z, calendarDateSchema } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  assertVersion,
  dateOnly,
  lockSemester,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";
import { savePlacement } from "./write.js";
import { withdrawPlacement } from "./publish.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockStudentEnrollment } from "../enrollment/data.js";
import type { Prisma } from "@lazuli/db";

const MAX_SELECTIONS = 100;
const MAX_REASON_LENGTH = 1200;
const MIN_REASON_LENGTH = 3;

const selection = z
  .array(z.object({ id: z.string().uuid(), version: z.number().int() }))
  .min(1)
  .max(MAX_SELECTIONS);
export const moveSchema = z.object({
  semesterId: z.string().uuid(),
  selections: selection,
  targetSemesterId: z.string().uuid().optional(),
  targetVersions: z.record(z.number().int()).optional(),
  planId: z.string().uuid(),
  effectiveDate: calendarDateSchema,
  reason: z.string().trim().max(MAX_REASON_LENGTH).default(""),
});
export const declineSchema = z.object({
  semesterId: z.string().uuid(),
  selections: selection,
  reason: z.string().trim().min(MIN_REASON_LENGTH).max(MAX_REASON_LENGTH),
});

export async function movePlacements(
  context: OrganizationContext,
  input: z.infer<typeof moveSchema>,
): Promise<{ count: number }> {
  for (const id of [
    ...new Set([input.semesterId, input.targetSemesterId ?? input.semesterId]),
  ].toSorted())
    await lockSemester(context, id);
  if (input.targetSemesterId && input.targetSemesterId !== input.semesterId)
    return moveToSemester(context, input);
  for (const selected of input.selections) await moveWithinSemester(context, { input, selected });
  return { count: input.selections.length };
}

type Placement = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;
type Selection = { id: string; version: number };

async function moveWithinSemester(
  context: OrganizationContext,
  { input, selected }: { input: z.infer<typeof moveSchema>; selected: Selection },
): Promise<void> {
  const row = await context.database.semesterPlacement.findFirst({
    where: { id: selected.id, semesterId: input.semesterId, deletedAt: null },
  });
  if (!row) throw notFound("Proposta não encontrada.");
  await lockStudentEnrollment(context.database, row.studentId);
  assertVersion(row.version, selected.version);
  const { current, sourceProgressId, stageId } = await sourceForMove(context, { row, input });
  await savePlacement(context, {
    id: current.id,
    version: current.version,
    semesterId: input.semesterId,
    studentId: current.studentId,
    planId: input.planId,
    stageId,
    sourceProgressId,
    mode: sourceProgressId ? "CONTINUE" : "ENTRY",
    effectiveDate: input.effectiveDate,
    notes: input.reason || current.notes || "",
  });
}

async function sourceForMove(
  context: OrganizationContext,
  { row, input }: { row: Placement; input: z.infer<typeof moveSchema> },
): Promise<{ current: Placement; sourceProgressId: string | null; stageId: string | null }> {
  let current = row;
  let sourceProgressId = row.sourceProgressId;
  let stageId = row.stageId;
  if (current.publishedAt && current.entryActionId) {
    const action = await context.database.enrollmentAction.findUniqueOrThrow({
      where: { id: current.entryActionId },
    });
    if (action.status === "SCHEDULED") {
      await withdrawPlacement(context, {
        id: current.id,
        version: current.version,
        reason: input.reason || "Revisão de destino pela coordenação",
      });
      current = await context.database.semesterPlacement.findUniqueOrThrow({
        where: { id: current.id },
      });
    }
  }
  if (current.publishedAt) {
    const progress = await context.database.pedagogicalProgress.findFirst({
      where: { enrollmentId: current.enrollmentId ?? "", endDate: null, deletedAt: null },
    });
    if (!progress) throw badRequest("O vínculo mudou. Atualize a organização.");
    sourceProgressId = progress.id;
    stageId = progress.stageId;
    await context.database.semesterPlacement.update({
      where: { id: current.id },
      data: {
        publishedAt: null,
        publishedById: null,
        entryActionId: null,
        sourceExitActionId: null,
        enrollmentId: null,
      },
    });
  }
  return { current, sourceProgressId, stageId };
}

async function moveToSemester(
  context: OrganizationContext,
  input: z.infer<typeof moveSchema>,
): Promise<{ count: number }> {
  const semesterId = input.targetSemesterId!;
  await context.database.period.findUniqueOrThrow({
    where: { id: semesterId },
  });
  for (const selected of input.selections)
    await moveAcrossSemester(context, {
      input,
      selected,
      semesterId,
    });
  return { count: input.selections.length };
}

async function moveAcrossSemester(
  context: OrganizationContext,
  {
    input,
    selected,
    semesterId,
  }: {
    input: z.infer<typeof moveSchema>;
    selected: Selection;
    semesterId: string;
  },
): Promise<void> {
  const source = await context.database.semesterPlacement.findFirst({
    where: { id: selected.id, semesterId: input.semesterId, deletedAt: null },
  });
  if (!source) throw notFound("Aluno não encontrado na organização de origem.");
  await lockStudentEnrollment(context.database, source.studentId);
  assertVersion(source.version, selected.version);
  const target = await context.database.semesterPlacement.findFirst({
    where: { semesterId, studentId: source.studentId, trackId: source.trackId, deletedAt: null },
  });
  if (target) {
    assertVersion(target.version, input.targetVersions?.[target.id] ?? 0);
    await movePlacements(context, {
      ...input,
      semesterId,
      targetSemesterId: semesterId,
      selections: [{ id: target.id, version: target.version }],
    });
    return;
  }
  const current = await currentSourceProgress(context, source);
  const sourceProgressId = current?.id ?? source.sourceProgressId;
  await savePlacement(context, {
    semesterId,
    studentId: source.studentId,
    version: 0,
    planId: input.planId,
    stageId: current?.stageId ?? source.stageId,
    sourceProgressId,
    mode: sourceProgressId ? "CONTINUE" : "ENTRY",
    effectiveDate: input.effectiveDate,
    notes: input.reason,
  });
}

async function currentSourceProgress(
  context: OrganizationContext,
  source: Placement,
): Promise<Prisma.PedagogicalProgressGetPayload<Prisma.PedagogicalProgressDefaultArgs> | null> {
  if (!source.enrollmentId) return null;
  return context.database.pedagogicalProgress.findFirst({
    where: { enrollmentId: source.enrollmentId, deletedAt: null, endDate: null },
  });
}

export async function declinePlacements(
  context: OrganizationContext,
  input: z.infer<typeof declineSchema>,
): Promise<{ count: number }> {
  const semester = await lockSemester(context, input.semesterId);
  if (dateOnly(semester.startDate) <= saoPauloDateOnly(context.now))
    throw badRequest(
      "Registre a não continuidade no próximo semestre. O vínculo atual exige uma movimentação própria.",
    );
  for (const selected of input.selections) {
    const row = await context.database.semesterPlacement.findFirst({
      where: { id: selected.id, semesterId: input.semesterId, deletedAt: null },
    });
    if (!row) throw notFound("Proposta não encontrada.");
    assertVersion(row.version, selected.version);
    if (row.publishedAt) await withdrawPlacement(context, { ...selected, reason: input.reason });
    await context.database.semesterPlacement.update({
      where: { id: row.id },
      data: { declinedAt: context.now, declinedReason: input.reason, version: { increment: 1 } },
    });
    await recordPlacementRevision(context, {
      id: row.id,
      action: "NOT_CONTINUING",
      reason: input.reason,
    });
  }
  return { count: input.selections.length };
}
