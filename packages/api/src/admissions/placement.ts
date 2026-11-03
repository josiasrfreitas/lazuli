import { randomUUID } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { intervalsOverlap, sessionEndInstant } from "@lazuli/domain";
import { getStorage, type StoredFileReference } from "@lazuli/storage";
import {
  type placementCalendarSchema,
  type placementFileSchema,
  type placementResultSchema,
  type placementScheduleSchema,
  type z,
} from "@lazuli/validators";
import type { Context } from "../trpc/context.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { activityTransaction } from "../activity/record.js";
import { leadSubject } from "../activity/subjects.js";
import { dateToTimeString, timeStringToDate } from "../classes/time.js";
import { assertTeacherEligible, lockTeacher } from "../teachers/availability.js";
import { dateOnly, lockCandidate, readCandidate } from "./candidates.js";
import { admissionStages } from "./catalog.js";
import { placementFileBytes } from "./placement-file-bytes.js";

type Operation<T> = {
  database: Prisma.TransactionClient;
  values: T;
  now: Date;
  recordedById: string;
};
type PlacementCalendarResult = {
  pendingPlacement: string | null;
  visits: { id: string; date: string; startTime: string; endTime: string; label: string }[];
  closedDays: { date: string; reason: string }[];
};
type PlacementCalendarVisit = Pick<
  Awaited<ReturnType<typeof placementVisit>>,
  "id" | "kind" | "date" | "startTime" | "endTime"
>;

export async function placementCalendar(
  database: Prisma.TransactionClient,
  input: z.infer<typeof placementCalendarSchema>,
): Promise<PlacementCalendarResult> {
  const candidate = input.candidateId ? await readCandidate(database, input.candidateId) : null;
  if (candidate && candidate.status !== "WAITING")
    throw badRequest("Reabra o lead para agendar o nivelamento.");
  const period = { gte: new Date(input.from), lte: new Date(input.through) };
  const [visits, closedDays] = await Promise.all([
    candidate
      ? database.entryVisit.findMany({
          where: {
            candidateId: candidate.id,
            deletedAt: null,
            status: { not: "CANCELLED" },
            OR: [{ date: period }, { kind: "PLACEMENT", status: "SCHEDULED" }],
          },
          select: {
            id: true,
            kind: true,
            status: true,
            date: true,
            startTime: true,
            endTime: true,
          },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        })
      : [],
    database.schoolClosedDay.findMany({
      where: { date: period, deletedAt: null },
      select: { date: true, reason: true },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    pendingPlacement:
      visits.find((visit) => visit.kind === "PLACEMENT" && visit.status === "SCHEDULED")?.id ??
      null,
    visits: visits
      .filter(
        (visit) => dateOnly(visit.date) >= input.from && dateOnly(visit.date) <= input.through,
      )
      .map((visit) => calendarVisit(visit)),
    closedDays: closedDays.map((day) => ({ date: dateOnly(day.date), reason: day.reason })),
  };
}

function calendarVisit(visit: PlacementCalendarVisit): PlacementCalendarResult["visits"][number] {
  let label = "Atendimento do lead";
  if (visit.kind === "PLACEMENT") label = "Nivelamento já agendado";
  if (visit.kind === "TRIAL") label = "Aula experimental";
  return {
    id: visit.id,
    date: dateOnly(visit.date),
    startTime: dateToTimeString(visit.startTime),
    endTime: dateToTimeString(visit.endTime),
    label,
  };
}

export async function schedulePlacement({
  database,
  values,
  now,
  recordedById,
}: Operation<z.infer<typeof placementScheduleSchema>>): Promise<{ id: string }> {
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
  await assertTeacherEligible({ database, teacherId: values.teacherId, date: values.date });
  await assertPlacementScheduleAvailable({ database, values, now, candidateId: candidate.id });
  await database.admissionCandidate.update({
    where: { id: candidate.id },
    data: {
      englishExperience: "SOME",
      stageId: null,
      recordedById,
    },
  });
  return database.entryVisit.create({
    data: {
      id: values.id,
      candidateId: candidate.id,
      kind: "PLACEMENT",
      teacherId: values.teacherId,
      format: values.format,
      date: new Date(values.date),
      startTime: timeStringToDate(values.startTime),
      endTime: timeStringToDate(values.endTime),
      recordedById,
    },
    select: { id: true },
  });
}

async function assertPlacementScheduleAvailable({
  database,
  values,
  now,
  candidateId,
}: {
  database: Prisma.TransactionClient;
  values: z.infer<typeof placementScheduleSchema>;
  now: Date;
  candidateId: string;
}): Promise<void> {
  if (sessionEndInstant({ date: values.date, endTime: values.startTime }) <= now)
    throw badRequest("Escolha um horário que ainda não começou.");
  const closed = await database.schoolClosedDay.findFirst({
    where: { date: new Date(values.date), deletedAt: null },
  });
  if (closed) throw badRequest("A escola está fechada nesta data.");
  const other = await database.entryVisit.findMany({
    where: {
      candidateId,
      deletedAt: null,
      status: { not: "CANCELLED" },
      OR: [{ date: new Date(values.date) }, { kind: "PLACEMENT", status: "SCHEDULED" }],
    },
  });
  if (other.some((row) => row.kind === "PLACEMENT" && row.status === "SCHEDULED"))
    throw badRequest("Conclua ou cancele o nivelamento já agendado.");
  if (
    other.some((row) =>
      intervalsOverlap(values, {
        startTime: dateToTimeString(row.startTime),
        endTime: dateToTimeString(row.endTime),
      }),
    )
  )
    throw badRequest("O lead já tem um atendimento neste horário.");
}

async function placementVisit(
  database: Prisma.TransactionClient,
  id: string,
): Promise<
  Prisma.EntryVisitGetPayload<{
    include: { assessment: { include: { correctedFile: true } }; candidate: true };
  }>
> {
  const visit = await database.entryVisit.findFirst({
    where: { id, kind: "PLACEMENT", deletedAt: null, candidate: { deletedAt: null } },
    include: { assessment: { include: { correctedFile: true } }, candidate: true },
  });
  if (!visit) throw notFound("Atendimento de nivelamento não encontrado.");
  return visit;
}

function assertEditable(visit: Awaited<ReturnType<typeof placementVisit>>, now: Date): void {
  if (
    (visit.candidate.status !== "WAITING" &&
      !(
        visit.candidate.status === "ENROLLED" &&
        visit.candidate.studentId &&
        !visit.assessment?.stageId
      )) ||
    visit.status === "CANCELLED" ||
    visit.status === "ABSENT"
  )
    throw badRequest("Este atendimento não pode receber prova ou resultado.");
  if (sessionEndInstant({ date: visit.date, endTime: visit.startTime }) > now)
    throw badRequest("Registre a prova depois do início do atendimento.");
}

function assertFileCanBeAttached(
  visit: Awaited<ReturnType<typeof placementVisit>>,
  kind: "ORIGINAL" | "CORRECTED",
): void {
  if (kind === "CORRECTED") {
    if (!visit.assessment) throw badRequest("Anexe a prova aplicada antes da versão corrigida.");
    if (visit.assessment.correctedFile)
      throw badRequest("Este atendimento já tem uma prova corrigida anexada.");
  } else if (visit.assessment) {
    throw badRequest("Este atendimento já tem uma prova anexada.");
  }
}

export async function uploadPlacementFile(
  ctx: Context & { staffUser: NonNullable<Context["staffUser"]> },
  values: z.input<typeof placementFileSchema>,
): Promise<{ id: string }> {
  const now = ctx.now ?? new Date();
  const kind = values.kind ?? "ORIGINAL";
  const bytes = placementFileBytes(values);
  const visit = await placementVisit(ctx.db, values.id);
  if (ctx.staffUser.role === "TEACHER" && visit.teacherId !== ctx.staffUser.id)
    throw notFound("Nivelamento não atribuído a você.");
  assertEditable(visit, now);
  assertFileCanBeAttached(visit, kind);
  const storage = getStorage();
  const reference = await putPlacementFile(storage, {
    visitId: visit.id,
    bytes,
    contentType: values.contentType,
  });
  try {
    return await activityTransaction(ctx, {
      action: "admissions.placementFile",
      work: async (database) =>
        persistPlacementUpload(database, {
          visit,
          values,
          now,
          kind,
          reference,
          byteLength: bytes.length,
          staffUser: ctx.staffUser,
        }),
      describe: async (_result, database) => ({
        subject: await leadSubject(database, visit.candidateId),
        description:
          kind === "CORRECTED"
            ? "Anexou a prova de nivelamento corrigida."
            : "Anexou a prova de nivelamento aplicada.",
      }),
    });
  } catch (error) {
    // Best-effort compensation: do not mask the original transaction failure.
    await storage.remove(reference).catch((): undefined => {});
    throw error;
  }
}

async function persistPlacementUpload(
  database: Prisma.TransactionClient,
  {
    visit,
    values,
    now,
    kind,
    reference,
    byteLength,
    staffUser,
  }: {
    visit: Awaited<ReturnType<typeof placementVisit>>;
    values: z.input<typeof placementFileSchema>;
    now: Date;
    kind: "ORIGINAL" | "CORRECTED";
    reference: StoredFileReference;
    byteLength: number;
    staffUser: NonNullable<Context["staffUser"]>;
  },
): Promise<{ id: string }> {
  await lockCandidate(database, visit.candidateId);
  const current = await placementVisit(database, values.id);
  if (staffUser.role === "TEACHER" && current.teacherId !== staffUser.id)
    throw notFound("Nivelamento não atribuído a você.");
  assertEditable(current, now);
  assertFileCanBeAttached(current, kind);
  const data = {
    visitId: visit.id,
    ...reference,
    fileName: values.fileName,
    contentType: values.contentType,
    byteLength,
    uploadedAt: now,
    uploadedById: staffUser.id,
  };
  await storePlacementAttachment(database, { data, kind });
  return { id: visit.id };
}

async function putPlacementFile(
  storage: ReturnType<typeof getStorage>,
  file: { visitId: string; bytes: Uint8Array; contentType: string },
): Promise<StoredFileReference> {
  return storage.put({
    key: `placement-assessments/${file.visitId}/${randomUUID()}`,
    bytes: file.bytes,
    contentType: file.contentType,
  });
}

async function storePlacementAttachment(
  database: Prisma.TransactionClient,
  {
    data,
    kind,
  }: {
    data: Prisma.EntryVisitAssessmentUncheckedCreateInput;
    kind: "ORIGINAL" | "CORRECTED";
  },
): Promise<void> {
  if (kind === "CORRECTED") {
    await database.entryVisitCorrectedFile.create({ data });
    return;
  }
  await database.entryVisitAssessment.create({ data });
  await database.entryVisit.update({
    where: { id: data.visitId },
    data: { status: "ATTENDED" },
  });
}

export async function downloadPlacementFile(
  database: Prisma.TransactionClient,
  options: {
    id: string;
    kind?: ("ORIGINAL" | "CORRECTED") | undefined;
  },
): Promise<{ fileName: string; contentType: string; base64: string }> {
  const { id, kind = "ORIGINAL" } = options;

  const visit = await placementVisit(database, id);
  const attachment = kind === "CORRECTED" ? visit.assessment?.correctedFile : visit.assessment;
  if (!attachment)
    throw notFound(
      kind === "CORRECTED" ? "Prova corrigida ainda não anexada." : "Prova ainda não anexada.",
    );
  const file = await getStorage().read(attachment);
  return {
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    base64: Buffer.from(file.bytes).toString("base64"),
  };
}

export async function recordPlacementResult({
  database,
  values,
  now,
  recordedById,
}: Operation<z.infer<typeof placementResultSchema>>): Promise<{ id: string }> {
  const snapshot = await placementVisit(database, values.id);
  await lockCandidate(database, snapshot.candidateId);
  const visit = await placementVisit(database, values.id);
  assertEditable(visit, now);
  if (!visit.assessment) throw badRequest("Anexe a prova antes de registrar o resultado.");
  const latest = await latestPlacement(database, visit.candidateId);
  if (latest?.id !== visit.id)
    throw badRequest("Registre o resultado no atendimento mais recente.");
  const activeStages = await admissionStages(database);
  if (!activeStages.some((stage) => stage.id === values.stageId))
    throw badRequest("Escolha um estágio ativo.");
  await database.entryVisitAssessment.update({
    where: { visitId: visit.id },
    data: {
      stageId: values.stageId,
      notes: values.notes || null,
      correctedAt: now,
      correctedById: recordedById,
    },
  });
  await database.admissionCandidate.update({
    where: { id: visit.candidateId },
    data: {
      englishExperience: "SOME",
      stageId: values.stageId,
      recordedById,
    },
  });
  return { id: visit.id };
}

async function latestPlacement(
  database: Prisma.TransactionClient,
  candidateId: string,
): Promise<Prisma.EntryVisitGetPayload<{ include: { assessment: true } }> | null> {
  return database.entryVisit.findFirst({
    where: { candidateId, kind: "PLACEMENT", deletedAt: null, status: { not: "CANCELLED" } },
    include: { assessment: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
  });
}

export async function assertPlacementReady(
  database: Prisma.TransactionClient,
  candidate: { id: string; englishExperience: string; stageId: string | null },
): Promise<void> {
  if (candidate.englishExperience !== "SOME") return;
  const latest = await latestPlacement(database, candidate.id);
  if (
    !latest ||
    latest.status !== "ATTENDED" ||
    !latest.assessment?.stageId ||
    latest.assessment.stageId !== candidate.stageId
  )
    throw badRequest("Conclua o nivelamento e registre o estágio antes da matrícula.");
}
