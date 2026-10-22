import type {
  OccurrenceCreate,
  InterventionCreate,
  InterventionFollowUp,
} from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { requireCurrentEnrollment } from "../enrollment/require-current.js";
import { recordActivity } from "../activity/record.js";
import { occurrenceRoster } from "./sessions.js";
import {
  assertEligibleResponsible,
  claimVersion,
  invalid,
  loadOccurrence,
  loadIntervention,
  type FollowUpContext,
} from "./data.js";
import { TRPCError } from "@trpc/server";

export async function createOccurrence(
  context: FollowUpContext,
  input: OccurrenceCreate,
): Promise<{ id: string }> {
  const roster = await occurrenceRoster(context, input.classSessionId);
  const student = roster.find((row) => row.id === input.studentId);
  if (!student) invalid("O aluno não pertencia à turma nesta data.");
  await requireCurrentEnrollment(context, input.studentId);
  const row = await context.database.pedagogicalOccurrence.create({
    data: {
      ...input,
      initialResponse: input.initialResponse || null,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, {
    context,
    action: "occurrences.create",
    details: {
      subject: { type: "student", id: student.id, name: student.fullName },
      description: input.title,
    },
  });
  return { id: row.id };
}
export async function linkOccurrences(
  context: FollowUpContext,
  input: { occurrenceId: string; relatedId: string },
): Promise<void> {
  if (input.occurrenceId === input.relatedId) invalid("Selecione duas ocorrências distintas.");
  const [first, second] = await Promise.all([
    loadOccurrence(context, input.occurrenceId),
    loadOccurrence(context, input.relatedId),
  ]);
  if (first.studentId !== second.studentId) invalid("Relacione ocorrências do mesmo aluno.");
  const [fromId, toId] = [first.id, second.id].toSorted() as [string, string];
  const created = await context.database.occurrenceRelation.createMany({
    data: [{ fromId, toId, recordedById: context.staffUser.id, createdAt: context.now }],
    skipDuplicates: true,
  });
  if (created.count)
    await recordActivity(context.database, {
      context,
      action: "occurrences.link",
      details: {
        subject: { type: "student", id: first.studentId, name: first.student.fullName },
        description: `${first.title} · ${second.title}`,
      },
    });
}
export async function updateOccurrence(
  context: FollowUpContext,
  input: { id: string; account: string; expectedUpdatedAt: Date },
): Promise<void> {
  const occurrence = await loadOccurrence(context, input.id);
  if (context.staffUser.role === "TEACHER" && occurrence.recordedById !== context.staffUser.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o autor ou a coordenação pode editar este relato.",
    });
  const changed = await context.database.pedagogicalOccurrence.updateMany({
    where: {
      id: occurrence.id,
      updatedAt: input.expectedUpdatedAt,
      deletedAt: null,
      ...(context.staffUser.role === "TEACHER" ? { recordedById: context.staffUser.id } : {}),
    },
    data: { account: input.account },
  });
  if (!changed.count)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O relato mudou. Atualize a página antes de salvar.",
    });
  await recordActivity(context.database, {
    context,
    action: "occurrences.update",
    details: {
      subject: { type: "student", id: occurrence.studentId, name: occurrence.student.fullName },
      description: `Relato editado: ${occurrence.title}`,
    },
  });
}
export async function createIntervention(
  context: FollowUpContext,
  input: InterventionCreate,
): Promise<{ id: string }> {
  const occurrences = await Promise.all(
    input.occurrenceIds.map((id) => loadOccurrence(context, id)),
  );
  const studentId = input.studentId ?? occurrences[0]?.studentId;
  if (!studentId) invalid("Selecione o aluno da intervenção.");
  if (occurrences.some((row) => row.studentId !== studentId))
    invalid("Selecione ocorrências do mesmo aluno.");
  const student = await context.database.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) invalid("Aluno não encontrado.");
  await requireCurrentEnrollment(context, studentId);
  await assertEligibleResponsible(context, input.responsibleId);
  if (input.performedOn > saoPauloDateOnly(context.now))
    invalid("Informe a data de uma tratativa já realizada.");
  const { occurrenceIds, performedOn, ...values } = input;
  const row = await context.database.pedagogicalIntervention.create({
    data: {
      ...values,
      performedOn: new Date(performedOn),
      studentId: student.id,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      occurrences: {
        create: occurrenceIds.map((occurrenceId) => ({ occurrenceId, createdAt: context.now })),
      },
    },
  });
  await recordActivity(context.database, {
    context,
    action: "interventions.create",
    details: {
      subject: { type: "student", id: student.id, name: student.fullName },
      description: input.title,
    },
  });
  return { id: row.id };
}
export async function addInterventionFollowUp(
  context: FollowUpContext,
  input: InterventionFollowUp,
): Promise<void> {
  const row = await loadIntervention(context, input.id);
  await requireCurrentEnrollment(context, row.studentId);
  await claimVersion(context, { id: input.id, version: input.version });
  await context.database.pedagogicalFollowUp.create({
    data: {
      interventionId: row.id,
      body: input.body,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, {
    context,
    action: "interventions.followUp",
    details: {
      subject: { type: "student", id: row.studentId, name: row.student.fullName },
      description: row.title,
    },
  });
}
export async function addInterventionOccurrence(
  context: FollowUpContext,
  input: { id: string; version: number; occurrenceId: string },
): Promise<void> {
  const [intervention, occurrence] = await Promise.all([
    loadIntervention(context, input.id),
    loadOccurrence(context, input.occurrenceId),
  ]);
  if (intervention.studentId !== occurrence.studentId)
    invalid("Escolha uma ocorrência do mesmo aluno.");
  await claimVersion(context, { id: input.id, version: input.version });
  const linked = await context.database.interventionOccurrence.createMany({
    data: [{ interventionId: input.id, occurrenceId: input.occurrenceId, createdAt: context.now }],
    skipDuplicates: true,
  });
  if (!linked.count) invalid("Esta ocorrência já motiva a intervenção.");
  await recordActivity(context.database, {
    context,
    action: "interventions.link",
    details: {
      subject: { type: "student", id: intervention.studentId, name: intervention.student.fullName },
      description: `${intervention.title} · ${occurrence.title}`,
    },
  });
}
