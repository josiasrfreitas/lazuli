import type { Prisma } from "@lazuli/db";
import {
  availabilityCovers,
  intervalsOverlap,
  responsibleTeacherId,
  sessionEndInstant,
  weekdayOf,
} from "@lazuli/domain";
import type { entryVisitScheduleSchema, entryVisitOutcomeSchema, z } from "@lazuli/validators";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  assertTeacherEligible,
  assertNoTeacherConflict,
  databaseSlotToCandidate,
  lockTeacher,
} from "../teachers/availability.js";
import { meetingKey, meetingsBetween } from "../teachers/schedule.js";
import { dateToTimeString, timeStringToDate } from "../classes/time.js";
import {
  assertAllocatable,
  dateOnly,
  lockCandidate,
  matchingClasses,
  readCandidate,
  type AdmissionCandidate,
} from "./candidates.js";

type ScheduleInput = {
  database: Prisma.TransactionClient;
  values: z.infer<typeof entryVisitScheduleSchema>;
  recordedById: string;
  now: Date;
};
type ResolvedVisit = {
  kind: "TRIAL" | "INTRODUCTION";
  teacherId: string | null;
  startTime: string;
  endTime: string;
  format: "IN_PERSON" | "ONLINE";
  classId: string | null;
  scheduleSlotId: string | null;
  classSessionId: string | null;
};
async function resolveVisit(input: ScheduleInput): Promise<ResolvedVisit> {
  const { values, database, now } = input;
  const meeting = values.meeting;
  if (meeting.kind === "INTRODUCTION")
    return resolveIntroduction({ database, values: { ...values, meeting } });
  const choices = await matchingClasses(database, { id: values.candidateId, date: values.date });
  if (!choices.some((row) => row.id === meeting.classId))
    throw badRequest("Turma incompatível com o interesse e a disponibilidade.");
  const rows = await meetingsBetween({ database, from: values.date, through: values.date, now });
  const match = rows.find(
    (row) =>
      meetingKey(row) ===
      meetingKey({
        classId: meeting.classId,
        slotId: meeting.scheduleSlotId,
        sessionId: meeting.classSessionId,
        date: values.date,
      }),
  );
  if (!match || match.cancelled || !responsibleTeacherId(match))
    throw badRequest("Encontro cancelado, inexistente ou sem professor. Escolha outro encontro.");
  return {
    kind: meeting.kind,
    teacherId: responsibleTeacherId(match),
    startTime: match.startTime,
    endTime: match.endTime,
    format: match.format,
    classId: match.classId,
    scheduleSlotId: match.slotId,
    classSessionId: match.sessionId,
  };
}
async function resolveIntroduction({
  database,
  values,
}: {
  database: Prisma.TransactionClient;
  values: ScheduleInput["values"] & {
    meeting: Extract<ScheduleInput["values"]["meeting"], { kind: "INTRODUCTION" }>;
  };
}): Promise<ResolvedVisit> {
  const meeting = values.meeting;
  await assertTeacherEligible({ database, teacherId: meeting.teacherId, date: values.date });
  await assertNoTeacherConflict({
    database,
    teacherId: meeting.teacherId,
    from: values.date,
    through: values.date,
    slots: [],
    candidateMeetings: [{ date: values.date, ...meeting }],
  });
  return {
    kind: meeting.kind,
    teacherId: meeting.teacherId,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    format: meeting.format,
    classId: null,
    scheduleSlotId: null,
    classSessionId: null,
  };
}
export async function scheduleVisit(input: ScheduleInput): Promise<{ id: string }> {
  const { database, values, recordedById } = input;
  await lockTeacher(database, "");
  await lockCandidate(database, values.candidateId);
  const existing = await database.entryVisit.findUnique({ where: { id: values.id } });
  if (existing) {
    if (existing.candidateId !== values.candidateId)
      throw badRequest("Identificador de agendamento já utilizado.");
    return { id: existing.id };
  }
  const candidate = await readCandidate(database, values.candidateId);
  assertAllocatable(candidate, values.date);
  await cancelPrevious(input);
  const meeting = await resolveVisit(input);
  await assertVisitAllowed(input, { candidate, meeting });
  await database.entryVisit.create({
    data: {
      id: values.id,
      candidateId: candidate.id,
      date: new Date(values.date),
      ...meeting,
      startTime: timeStringToDate(meeting.startTime),
      endTime: timeStringToDate(meeting.endTime),
      notes: values.notes || null,
      previousVisitId: values.previousVisitId ?? null,
      recordedById,
    },
  });
  return { id: values.id };
}
async function cancelPrevious({ database, values, recordedById }: ScheduleInput): Promise<void> {
  if (values.previousVisitId) {
    const previous = await database.entryVisit.findUnique({
      where: { id: values.previousVisitId },
    });
    if (!previous || previous.candidateId !== values.candidateId || previous.status !== "SCHEDULED")
      throw badRequest("Somente um agendamento pendente deste interessado pode ser remarcado.");
    await database.entryVisit.update({
      where: { id: previous.id },
      data: {
        status: "CANCELLED",
        cancellationReason: "Remarcada para novo encontro.",
        recordedById,
      },
    });
  }
}
async function assertVisitAllowed(
  { database, values, now }: ScheduleInput,
  {
    candidate,
    meeting,
  }: {
    candidate: AdmissionCandidate;
    meeting: ResolvedVisit;
  },
): Promise<void> {
  if (sessionEndInstant({ date: values.date, endTime: meeting.startTime }) <= now)
    throw badRequest("Escolha um encontro que ainda não começou.");
  if (
    !availabilityCovers(
      candidate.availability.map((slot) => databaseSlotToCandidate(slot)),
      [{ weekday: weekdayOf(values.date), ...meeting }],
    )
  )
    throw badRequest(
      "O horário está fora da disponibilidade informada. Atualize-a antes de agendar.",
    );
  if (candidate.format !== meeting.format)
    throw badRequest("O formato do encontro é diferente do interesse registrado.");
  const closed = await database.schoolClosedDay.findFirst({
    where: { date: new Date(values.date), deletedAt: null },
  });
  if (closed) throw badRequest("A escola está fechada nesta data.");
  const other = await database.entryVisit.findMany({
    where: {
      candidateId: candidate.id,
      date: new Date(values.date),
      status: { not: "CANCELLED" },
      deletedAt: null,
    },
  });
  if (
    other.some((row) =>
      intervalsOverlap(meeting, {
        startTime: dateToTimeString(row.startTime),
        endTime: dateToTimeString(row.endTime),
      }),
    )
  )
    throw badRequest("Este interessado já possui outro encontro neste horário.");
}
export async function recordVisitOutcome(input: {
  database: Prisma.TransactionClient;
  values: z.infer<typeof entryVisitOutcomeSchema>;
  recordedById: string;
  now: Date;
}): Promise<{ id: string }> {
  const { database, values, now, recordedById } = input;
  await lockTeacher(database, "");
  const visit = await database.entryVisit.findUnique({ where: { id: values.id } });
  if (!visit || visit.deletedAt) throw notFound("Aula de entrada não encontrada.");
  if (visit.status === "CANCELLED") throw badRequest("Aula cancelada. Agende uma nova aula.");
  const actual =
    values.status === "CANCELLED" ? null : await outcomeMeeting({ database, visit, now });
  if (
    values.status !== "CANCELLED" &&
    sessionEndInstant({ date: visit.date, endTime: actual?.startTime ?? visit.startTime }) > now
  )
    throw badRequest("Registre o comparecimento após o início da aula.");
  return database.entryVisit.update({
    where: { id: visit.id },
    data: {
      status: values.status,
      recordedById,
      ...outcomeData(values, actual),
    },
    select: { id: true },
  });
}
async function outcomeMeeting({
  database,
  visit,
  now,
}: {
  database: Prisma.TransactionClient;
  visit: Prisma.EntryVisitGetPayload<Record<string, never>>;
  now: Date;
}): Promise<Awaited<ReturnType<typeof meetingsBetween>>[number] | null> {
  if (visit.kind !== "TRIAL") return null;
  const meetings = await meetingsBetween({
    database,
    from: dateOnly(visit.date),
    through: dateOnly(visit.date),
    now,
  });
  const current = meetings.find(
    (row) =>
      meetingKey(row) ===
      meetingKey({
        classId: visit.classId!,
        slotId: visit.scheduleSlotId,
        sessionId: visit.classSessionId,
        date: dateOnly(visit.date),
      }),
  );
  if (!current || current.cancelled || !responsibleTeacherId(current))
    throw badRequest(
      "O encontro da turma foi cancelado ou está sem professor. Cancele ou remarque a aula de entrada.",
    );
  return current;
}

function outcomeData(
  values: z.infer<typeof entryVisitOutcomeSchema>,
  actual: Awaited<ReturnType<typeof outcomeMeeting>>,
): Prisma.EntryVisitUncheckedUpdateInput {
  if (values.status === "CANCELLED") return { cancellationReason: values.notes };
  const data: Prisma.EntryVisitUncheckedUpdateInput = { notes: values.notes || null };
  if (actual)
    Object.assign(data, {
      teacherId: responsibleTeacherId(actual),
      startTime: timeStringToDate(actual.startTime),
      endTime: timeStringToDate(actual.endTime),
    });
  return data;
}
