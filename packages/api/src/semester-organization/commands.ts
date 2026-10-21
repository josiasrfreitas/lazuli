import { z, calendarDateSchema, closedDayReasonSchema } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  assertVersion,
  dateOnly,
  lockSemester,
  readSlots,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";
import { savePlacement } from "./write.js";
import { withdrawPlacement } from "./publish.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { lockStudentEnrollment } from "../enrollment/data.js";

const selection = z
  .array(z.object({ id: z.string().uuid(), version: z.number().int() }))
  .min(1)
  .max(100);
export const moveSchema = z.object({
  semesterId: z.string().uuid(),
  selections: selection,
  targetSemesterId: z.string().uuid().optional(),
  targetVersions: z.record(z.number().int()).optional(),
  planId: z.string().uuid(),
  effectiveDate: calendarDateSchema,
  reason: z.string().trim().max(1200).default(""),
});
export const declineSchema = z.object({
  semesterId: z.string().uuid(),
  selections: selection,
  reason: z.string().trim().min(3).max(1200),
});

export async function movePlacements(
  context: OrganizationContext,
  input: z.infer<typeof moveSchema>,
) {
  for (const id of [
    ...new Set([input.semesterId, input.targetSemesterId ?? input.semesterId]),
  ].sort())
    await lockSemester(context, id);
  if (input.targetSemesterId && input.targetSemesterId !== input.semesterId)
    return moveToSemester(context, input);
  for (const selected of input.selections) {
    let row = await context.database.semesterPlacement.findFirst({
      where: { id: selected.id, semesterId: input.semesterId, deletedAt: null },
    });
    if (!row) throw notFound("Proposta não encontrada.");
    await lockStudentEnrollment(context.database, row.studentId);
    assertVersion(row.version, selected.version);
    let sourceProgressId = row.sourceProgressId;
    let stageId = row.stageId;
    if (row.publishedAt && row.entryActionId) {
      const action = await context.database.enrollmentAction.findUniqueOrThrow({
        where: { id: row.entryActionId },
      });
      if (action.status === "SCHEDULED") {
        await withdrawPlacement(context, {
          id: row.id,
          version: row.version,
          reason: input.reason || "Revisão de destino pela coordenação",
        });
        row = await context.database.semesterPlacement.findUniqueOrThrow({ where: { id: row.id } });
      }
    }
    if (row.publishedAt) {
      const progress = await context.database.pedagogicalProgress.findFirst({
        where: { enrollmentId: row.enrollmentId ?? "", endDate: null, deletedAt: null },
      });
      if (!progress) throw badRequest("O vínculo mudou. Atualize a organização.");
      sourceProgressId = progress.id;
      stageId = progress.stageId;
      await context.database.semesterPlacement.update({
        where: { id: row.id },
        data: {
          publishedAt: null,
          publishedById: null,
          entryActionId: null,
          sourceExitActionId: null,
          enrollmentId: null,
          availabilityId: null,
        },
      });
    }
    await savePlacement(context, {
      id: row.id,
      version: row.version,
      semesterId: input.semesterId,
      studentId: row.studentId,
      planId: input.planId,
      stageId,
      sourceProgressId,
      mode: sourceProgressId ? "CONTINUE" : "ENTRY",
      effectiveDate: input.effectiveDate,
      notes: input.reason || row.notes || "",
    });
  }
  return { count: input.selections.length };
}

async function moveToSemester(context: OrganizationContext, input: z.infer<typeof moveSchema>) {
  const semesterId = input.targetSemesterId!;
  const targetSemester = await context.database.semester.findUniqueOrThrow({
    where: { id: semesterId },
  });
  for (const selected of input.selections) {
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
      continue;
    }
    const current = source.enrollmentId
      ? await context.database.pedagogicalProgress.findFirst({
          where: { enrollmentId: source.enrollmentId, deletedAt: null, endDate: null },
        })
      : null;
    const availability = await context.database.studentAvailability.findFirst({
      where: { semesterId, studentId: source.studentId, deletedAt: null },
    });
    if (!availability) {
      const previous = await context.database.studentAvailability.findFirst({
        where: { semesterId: input.semesterId, studentId: source.studentId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (previous)
        await context.database.studentAvailability.create({
          data: {
            semesterId,
            studentId: source.studentId,
            confirmed: false,
            formats: previous.formats,
            slots: readSlots(previous.slots),
            validUntil: targetSemester.endDate,
            notes: previous.notes,
            recordedById: context.staffUser.id,
          },
        });
    }
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
  return { count: input.selections.length };
}

export async function declinePlacements(
  context: OrganizationContext,
  input: z.infer<typeof declineSchema>,
) {
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
    await recordPlacementRevision(context, row.id, "NOT_CONTINUING", input.reason);
  }
  return { count: input.selections.length };
}
export const closedRangeSchema = z
  .object({ from: calendarDateSchema, through: calendarDateSchema, reason: closedDayReasonSchema })
  .refine(
    (value) =>
      value.from <= value.through &&
      new Date(value.through).getTime() - new Date(value.from).getTime() <= 366 * 86_400_000,
    "Escolha um intervalo de até um ano.",
  );
export async function closeRange(
  context: OrganizationContext,
  input: z.infer<typeof closedRangeSchema>,
) {
  const dates: Date[] = [];
  for (
    let date = new Date(input.from);
    date <= new Date(input.through);
    date = new Date(date.getTime() + 86_400_000)
  )
    dates.push(date);
  const result = await context.database.schoolClosedDay.createMany({
    data: dates.map((date) => ({ date, reason: input.reason, createdById: context.staffUser.id })),
    skipDuplicates: true,
  });
  const affected = await context.database.classSession.count({
    where: { deletedAt: null, date: { gte: new Date(input.from), lte: new Date(input.through) } },
  });
  await recordActivity(context.database, context, "calendar.addClosedDay", {
    subject: { type: "school", name: "Calendário letivo" },
    description: `${input.reason} · ${input.from} a ${input.through}`,
  });
  return { added: result.count, affected };
}

export const periodSchema = z
  .object({
    semesterId: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    previousStart: calendarDateSchema,
    previousEnd: calendarDateSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "O encerramento deve ser posterior ao início.",
  });
export async function updatePeriod(
  context: OrganizationContext,
  input: z.infer<typeof periodSchema>,
) {
  const previous = await lockSemester(context, input.semesterId);
  if (
    dateOnly(previous.startDate) !== input.previousStart ||
    dateOnly(previous.endDate) !== input.previousEnd
  )
    throw badRequest("O período mudou. Atualize a página antes de salvar.");
  const startDate = new Date(input.startDate),
    endDate = new Date(input.endDate);
  const overlap = await context.database.semester.findFirst({
    where: {
      id: { not: input.semesterId },
      deletedAt: null,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) throw badRequest(`O período coincide com ${overlap.name}. Ajuste as datas.`);
  const outside = await context.database.semesterPlacement.count({
    where: {
      semesterId: input.semesterId,
      deletedAt: null,
      declinedAt: null,
      publishedAt: { not: null },
      OR: [{ effectiveDate: { lt: startDate } }, { effectiveDate: { gt: endDate } }],
    },
  });
  if (outside)
    throw badRequest(
      `${outside} alocações confirmadas ficariam fora do período. Revise suas vigências antes de mudar estas datas.`,
    );
  await context.database.semester.update({
    where: { id: input.semesterId },
    data: { name: input.name, startDate, endDate },
  });
  const affected = await context.database.classSession.count({
    where: {
      class: { semesterId: input.semesterId },
      deletedAt: null,
      OR: [{ date: { lt: startDate } }, { date: { gt: endDate } }],
    },
  });
  await recordActivity(context.database, context, "semesterOrganization.updatePeriod", {
    subject: { type: "school", name: input.name },
    description: `Período revisado: ${input.startDate} a ${input.endDate}.`,
  });
  return { affected };
}
