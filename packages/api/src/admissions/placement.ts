import { randomUUID } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { intervalsOverlap, sessionEndInstant } from "@lazuli/domain";
import { getStorage } from "@lazuli/storage";
import { MAX_PLACEMENT_FILE_BYTES, type placementCalendarSchema, type placementFileSchema, type placementResultSchema, type placementScheduleSchema, type z } from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { activityTransaction } from "../activity/record.js";
import { leadSubject } from "../activity/subjects.js";
import { dateToTimeString, timeStringToDate } from "../classes/time.js";
import { lockTeacher } from "../teachers/availability.js";
import { dateOnly, lockCandidate, readCandidate } from "./candidates.js";
import { admissionStages } from "./catalog.js";

type Operation<T> = { database: Prisma.TransactionClient; values: T; now: Date; recordedById: string };

export async function placementCalendar(database: Prisma.TransactionClient, input: z.infer<typeof placementCalendarSchema>) {
  const candidate = input.candidateId ? await readCandidate(database, input.candidateId) : null;
  if (candidate && candidate.status !== "WAITING") throw badRequest("Reabra o lead para agendar o nivelamento.");
  const period = { gte: new Date(input.from), lte: new Date(input.through) };
  const [visits, closedDays] = await Promise.all([
    candidate ? database.entryVisit.findMany({
      where: {
        candidateId: candidate.id, deletedAt: null, status: { not: "CANCELLED" },
        OR: [{ date: period }, { kind: "PLACEMENT", status: "SCHEDULED" }],
      },
      select: { id: true, kind: true, status: true, date: true, startTime: true, endTime: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }) : [],
    database.schoolClosedDay.findMany({
      where: { date: period, deletedAt: null },
      select: { date: true, reason: true },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    pendingPlacement: visits.find(visit => visit.kind === "PLACEMENT" && visit.status === "SCHEDULED")?.id ?? null,
    visits: visits.filter(visit => dateOnly(visit.date) >= input.from && dateOnly(visit.date) <= input.through)
      .map(visit => ({
        id: visit.id, date: dateOnly(visit.date),
        startTime: dateToTimeString(visit.startTime), endTime: dateToTimeString(visit.endTime),
        label: visit.kind === "PLACEMENT" ? "Nivelamento já agendado" : visit.kind === "TRIAL" ? "Aula experimental" : "Atendimento do lead",
      })),
    closedDays: closedDays.map(day => ({ date: dateOnly(day.date), reason: day.reason })),
  };
}

export async function schedulePlacement({ database, values, now, recordedById }: Operation<z.infer<typeof placementScheduleSchema>>) {
  await lockTeacher(database, "");
  await lockCandidate(database, values.candidateId);
  const candidate = await readCandidate(database, values.candidateId);
  if (candidate.status !== "WAITING") throw badRequest("Reabra o lead para agendar o nivelamento.");
  const existing = await database.entryVisit.findUnique({ where: { id: values.id } });
  if (existing) {
    if (existing.candidateId !== candidate.id || existing.kind !== "PLACEMENT")
      throw badRequest("Identificador de agendamento já utilizado.");
    return { id: existing.id };
  }
  if (sessionEndInstant({ date: values.date, endTime: values.startTime }) <= now)
    throw badRequest("Escolha um horário que ainda não começou.");
  const closed = await database.schoolClosedDay.findFirst({ where: { date: new Date(values.date), deletedAt: null } });
  if (closed) throw badRequest("A escola está fechada nesta data.");
  const other = await database.entryVisit.findMany({ where: {
    candidateId: candidate.id, deletedAt: null, status: { not: "CANCELLED" },
    OR: [{ date: new Date(values.date) }, { kind: "PLACEMENT", status: "SCHEDULED" }],
  } });
  if (other.some(row => row.kind === "PLACEMENT" && row.status === "SCHEDULED"))
    throw badRequest("Conclua ou cancele o nivelamento já agendado.");
  if (other.some(row => intervalsOverlap(values, {
    startTime: dateToTimeString(row.startTime), endTime: dateToTimeString(row.endTime),
  }))) throw badRequest("O lead já tem um atendimento neste horário.");
  await database.admissionCandidate.update({ where: { id: candidate.id }, data: {
    englishExperience: "SOME", stageId: null, recordedById,
  } });
  return database.entryVisit.create({ data: {
    id: values.id, candidateId: candidate.id, kind: "PLACEMENT", format: values.format,
    date: new Date(values.date), startTime: timeStringToDate(values.startTime),
    endTime: timeStringToDate(values.endTime), recordedById,
  }, select: { id: true } });
}

async function placementVisit(database: Prisma.TransactionClient, id: string) {
  const visit = await database.entryVisit.findFirst({
    where: { id, kind: "PLACEMENT", deletedAt: null, candidate: { deletedAt: null } },
    include: { assessment: true, candidate: true },
  });
  if (!visit) throw notFound("Atendimento de nivelamento não encontrado.");
  return visit;
}

function assertEditable(visit: Awaited<ReturnType<typeof placementVisit>>, now: Date) {
  if (visit.candidate.status !== "WAITING" || visit.status === "CANCELLED" || visit.status === "ABSENT")
    throw badRequest("Este atendimento não pode receber prova ou resultado.");
  if (sessionEndInstant({ date: visit.date, endTime: visit.startTime }) > now)
    throw badRequest("Registre a prova depois do início do atendimento.");
}

function fileBytes(values: z.infer<typeof placementFileSchema>) {
  const bytes = Buffer.from(values.base64, "base64");
  if (!bytes.length || bytes.length > MAX_PLACEMENT_FILE_BYTES)
    throw badRequest("Envie um arquivo de até 5 MB.");
  const signatures: Record<string, number[]> = {
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };
  if (!signatures[values.contentType]!.every((byte, index) => bytes[index] === byte))
    throw badRequest("O conteúdo não corresponde a um arquivo PDF, JPG ou PNG válido.");
  return bytes;
}

export async function uploadPlacementFile(ctx: Context & { staffUser: NonNullable<Context["staffUser"]> }, values: z.infer<typeof placementFileSchema>) {
  const now = ctx.now ?? new Date();
  const bytes = fileBytes(values);
  const visit = await placementVisit(ctx.db, values.id);
  if (ctx.staffUser.role === "TEACHER" && visit.teacherId !== ctx.staffUser.id) throw notFound("Nivelamento não atribuído a você.");
  assertEditable(visit, now);
  if (visit.assessment) throw badRequest("Este atendimento já tem uma prova anexada.");
  const storage = getStorage();
  const reference = await storage.put({
    key: `placement-assessments/${visit.id}/${randomUUID()}`, bytes, contentType: values.contentType,
  });
  try {
    return await activityTransaction(ctx, "admissions.placementFile", async database => {
      await lockCandidate(database, visit.candidateId);
      const current = await placementVisit(database, values.id);
      if (ctx.staffUser.role === "TEACHER" && current.teacherId !== ctx.staffUser.id) throw notFound("Nivelamento não atribuído a você.");
      assertEditable(current, now);
      if (current.assessment) throw badRequest("Este atendimento já tem uma prova anexada.");
      await database.entryVisitAssessment.create({ data: {
        visitId: visit.id, ...reference, fileName: values.fileName,
        contentType: values.contentType, byteLength: bytes.length, uploadedAt: now,
        uploadedById: ctx.staffUser.id,
      } });
      await database.entryVisit.update({ where: { id: visit.id }, data: { status: "ATTENDED" } });
      return { id: visit.id };
    }, async (_result, database) => ({ subject: await leadSubject(database, visit.candidateId) }));
  } catch (error) {
    // Best-effort compensation: do not mask the original transaction failure.
    await storage.remove(reference).catch(() => undefined);
    throw error;
  }
}

export async function downloadPlacementFile(database: Prisma.TransactionClient, id: string) {
  const visit = await placementVisit(database, id);
  const attachment = visit.assessment;
  if (!attachment) throw notFound("Prova ainda não anexada.");
  const file = await getStorage().read(attachment);
  return { fileName: attachment.fileName, contentType: attachment.contentType, base64: Buffer.from(file.bytes).toString("base64") };
}

export async function recordPlacementResult({ database, values, now, recordedById }: Operation<z.infer<typeof placementResultSchema>>) {
  const snapshot = await placementVisit(database, values.id);
  await lockCandidate(database, snapshot.candidateId);
  const visit = await placementVisit(database, values.id);
  assertEditable(visit, now);
  if (!visit.assessment) throw badRequest("Anexe a prova antes de registrar o resultado.");
  const latest = await latestPlacement(database, visit.candidateId);
  if (latest?.id !== visit.id) throw badRequest("Registre o resultado no atendimento mais recente.");
  if (!(await admissionStages(database)).some(stage => stage.id === values.stageId))
    throw badRequest("Escolha um estágio ativo.");
  await database.entryVisitAssessment.update({ where: { visitId: visit.id }, data: {
    stageId: values.stageId, notes: values.notes || null, correctedAt: now, correctedById: recordedById,
  } });
  await database.admissionCandidate.update({ where: { id: visit.candidateId }, data: {
    englishExperience: "SOME", stageId: values.stageId, recordedById,
  } });
  return { id: visit.id };
}

function latestPlacement(database: Prisma.TransactionClient, candidateId: string) {
  return database.entryVisit.findFirst({
    where: { candidateId, kind: "PLACEMENT", deletedAt: null, status: { not: "CANCELLED" } },
    include: { assessment: true }, orderBy: [{ date: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
  });
}

export async function assertPlacementReady(database: Prisma.TransactionClient, candidate: { id: string; englishExperience: string; stageId: string | null }) {
  if (candidate.englishExperience !== "SOME") return;
  const latest = await latestPlacement(database, candidate.id);
  if (!latest || latest.status !== "ATTENDED" || !latest.assessment?.stageId || latest.assessment.stageId !== candidate.stageId)
    throw badRequest("Conclua o nivelamento e registre o estágio antes da matrícula.");
}
