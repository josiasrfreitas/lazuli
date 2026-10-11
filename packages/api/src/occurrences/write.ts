import type { OccurrenceCreate, InterventionCreate, InterventionUpdate } from "@lazuli/validators";
import { recordActivity } from "../activity/record.js";
import { occurrenceRoster } from "./sessions.js";
import {
  assertEligibleTeacher,
  claimVersion,
  invalid,
  loadOccurrence,
  loadIntervention,
  type FollowUpContext,
} from "./data.js";
import { TRPCError } from "@trpc/server";

export async function createOccurrence(context: FollowUpContext, input: OccurrenceCreate) {
  const roster = await occurrenceRoster(context, input.classSessionId);
  const student = roster.find((row) => row.id === input.studentId);
  if (!student) invalid("O aluno não pertencia à turma nesta data.");
  const row = await context.database.pedagogicalOccurrence.create({
    data: {
      ...input,
      initialResponse: input.initialResponse || null,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, context, "occurrences.create", {
    subject: { type: "student", id: student.id, name: student.fullName },
    description: input.title,
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
  const [fromId, toId] = [first.id, second.id].sort() as [string, string];
  const created = await context.database.occurrenceRelation.createMany({
    data: [{ fromId, toId, recordedById: context.staffUser.id, createdAt: context.now }],
    skipDuplicates: true,
  });
  if (created.count)
    await recordActivity(context.database, context, "occurrences.link", {
      subject: { type: "student", id: first.studentId, name: first.student.fullName },
      description: `${first.title} · ${second.title}`,
    });
}
export async function addOccurrenceNote(
  context: FollowUpContext,
  input: { id: string; body: string },
): Promise<void> {
  const occurrence = await loadOccurrence(context, input.id);
  await context.database.pedagogicalFollowUp.create({
    data: {
      occurrenceId: input.id,
      kind: "NOTE",
      body: input.body,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, context, "occurrences.note", {
    subject: { type: "student", id: occurrence.studentId, name: occurrence.student.fullName },
    description: `Complemento do relato: ${occurrence.title}`,
  });
}
export async function createIntervention(context: FollowUpContext, input: InterventionCreate) {
  const occurrences = await Promise.all(
    input.occurrenceIds.map((id) => loadOccurrence(context, id)),
  );
  const first = occurrences[0];
  if (!first || occurrences.some((row) => row.studentId !== first.studentId))
    invalid("Reúna pelo menos duas ocorrências do mesmo aluno.");
  await assertEligibleTeacher(context, input.teacherId);
  const { occurrenceIds, dueOn, ...values } = input;
  const row = await context.database.pedagogicalIntervention.create({
    data: {
      ...values,
      dueOn: dueOn ? new Date(dueOn) : null,
      studentId: first.studentId,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      occurrences: {
        create: occurrenceIds.map((occurrenceId) => ({ occurrenceId, createdAt: context.now })),
      },
    },
  });
  await recordActivity(context.database, context, "interventions.create", {
    subject: { type: "student", id: first.studentId, name: first.student.fullName },
    description: input.title,
  });
  return { id: row.id };
}
function assertTransition(status: string, kind: InterventionUpdate["kind"]): void {
  if (kind === "START" && status !== "OPEN") invalid("Esta intervenção já foi iniciada.");
  if (kind === "REOPEN" && status !== "CONCLUDED")
    invalid("Somente uma intervenção concluída pode ser reaberta.");
  if (status === "CONCLUDED" && kind !== "REOPEN" && kind !== "NOTE")
    invalid("Reabra a intervenção antes de alterá-la.");
}
async function assignmentNote(
  context: FollowUpContext,
  input: InterventionUpdate,
  previous: string,
): Promise<string> {
  if (!input.teacherId) return input.body;
  if (context.staffUser.role === "TEACHER") throw new TRPCError({ code: "FORBIDDEN" });
  const teacher = await assertEligibleTeacher(context, input.teacherId);
  return `Responsável: ${previous} → ${teacher.name}. ${input.body}`;
}
export async function updateIntervention(
  context: FollowUpContext,
  input: InterventionUpdate,
): Promise<void> {
  const row = await loadIntervention(context, input.id);
  assertTransition(row.status, input.kind);
  const body = await assignmentNote(context, input, row.teacher.name);
  const status =
    input.kind === "CONCLUDE"
      ? "CONCLUDED"
      : input.kind === "START" || input.kind === "REOPEN"
        ? "IN_PROGRESS"
        : row.status;
  await claimVersion(context, input.id, input.version, {
    status,
    ...(input.teacherId ? { teacherId: input.teacherId } : {}),
    ...(input.nextStep ? { nextStep: input.nextStep } : {}),
    ...(input.dueOn !== undefined ? { dueOn: input.dueOn ? new Date(input.dueOn) : null } : {}),
    concludedAt: status === "CONCLUDED" ? (row.concludedAt ?? context.now) : null,
    outcome: input.kind === "CONCLUDE" ? input.body : status === "CONCLUDED" ? row.outcome : null,
  });
  await context.database.pedagogicalFollowUp.create({
    data: {
      interventionId: row.id,
      kind: input.kind,
      body,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, context, "interventions.update", {
    subject: { type: "student", id: row.studentId, name: row.student.fullName },
    description: `${row.title} · ${input.kind === "CONCLUDE" ? "Concluída" : input.kind === "REOPEN" ? "Reaberta" : "Acompanhamento registrado"}`,
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
  if (intervention.status === "CONCLUDED")
    invalid("Reabra a intervenção para incluir novas ocorrências.");
  if (intervention.studentId !== occurrence.studentId)
    invalid("Escolha uma ocorrência do mesmo aluno.");
  await claimVersion(context, input.id, input.version);
  const linked = await context.database.interventionOccurrence.createMany({
    data: [{ interventionId: input.id, occurrenceId: input.occurrenceId, createdAt: context.now }],
    skipDuplicates: true,
  });
  if (!linked.count) invalid("Esta ocorrência já motiva a intervenção.");
  await context.database.pedagogicalFollowUp.create({
    data: {
      interventionId: input.id,
      kind: "LINK",
      body: `Ocorrência incluída: ${occurrence.title}`,
      recordedById: context.staffUser.id,
      createdAt: context.now,
    },
  });
  await recordActivity(context.database, context, "interventions.link", {
    subject: { type: "student", id: intervention.studentId, name: intervention.student.fullName },
    description: `${intervention.title} · ${occurrence.title}`,
  });
}
