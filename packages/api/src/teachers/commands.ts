import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, weekdayOf } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  assertNoTeacherConflict,
  assertTeacherEligible,
  databaseSlotToCandidate,
  lockTeacher,
} from "./availability.js";
import { freezeStartedMeetings } from "./freeze-today.js";
import { meetingKey, meetingsBetween } from "./schedule.js";

type Database = Prisma.TransactionClient;
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const utcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export async function createTeacher(input: {
  database: Database;
  values: { name: string; cpf: string; email: string; isEnabled: boolean };
}): Promise<{ id: string }> {
  await assertUniqueIdentity(input.database, input.values);
  const teacher = await input.database.user.create({
    data: {
      name: input.values.name,
      email: input.values.email,
      role: "TEACHER",
      isEnabled: input.values.isEnabled,
      teacherProfile: { create: { cpf: input.values.cpf } },
    },
    select: { id: true },
  });
  return teacher;
}

export async function updateTeacher(input: {
  database: Database;
  values: { id: string; name: string; cpf: string; email: string; isEnabled: boolean };
}): Promise<{ id: string }> {
  const current = await input.database.user.findUnique({
    where: { id: input.values.id },
    select: { role: true, deletedAt: true },
  });
  if (!current || current.role !== "TEACHER" || current.deletedAt)
    throw notFound("Professor não encontrado.");
  await assertUniqueIdentity(input.database, input.values, input.values.id);
  return input.database.user.update({
    where: { id: input.values.id },
    data: {
      name: input.values.name,
      email: input.values.email,
      isEnabled: input.values.isEnabled,
      teacherProfile: {
        upsert: { create: { cpf: input.values.cpf }, update: { cpf: input.values.cpf } },
      },
    },
    select: { id: true },
  });
}

async function assertUniqueIdentity(
  database: Database,
  values: { cpf: string; email: string },
  exceptId?: string,
): Promise<void> {
  const [emailOwner, cpfOwner] = await Promise.all([
    database.user.findFirst({
      where: {
        email: { equals: values.email, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    }),
    database.teacherProfile.findUnique({ where: { cpf: values.cpf }, select: { userId: true } }),
  ]);
  if (emailOwner || (cpfOwner && cpfOwner.userId !== exceptId))
    throw badRequest("CPF ou e-mail já cadastrado. Localize a identidade existente.");
}

export async function assignClassTeacher(input: {
  database: Database;
  classId: string;
  teacherId: string;
  effectiveDate: string;
  recordedById: string;
  now: Date;
}): Promise<void> {
  if (input.effectiveDate < saoPauloDateOnly(input.now))
    throw badRequest("A vigência não pode ser retroativa.");
  await lockTeacher(input.database, input.teacherId);
  const classRow = await input.database.class.findUnique({
    where: { id: input.classId },
    include: {
      semester: { select: { startDate: true, endDate: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
      },
      teacherAssignments: {
        where: { supersededAt: null, effectiveDate: { gt: utcDate(input.effectiveDate) } },
        orderBy: { effectiveDate: "asc" },
        take: 1,
        select: { effectiveDate: true },
      },
    },
  });
  if (!classRow || classRow.deletedAt) throw notFound("Turma não encontrada.");
  if (input.effectiveDate < dateOnly(classRow.semester.startDate))
    throw badRequest("Escolha uma vigência a partir do início do semestre da turma.");
  if (input.effectiveDate > dateOnly(classRow.semester.endDate))
    throw badRequest("Data fora do semestre da turma.");
  await assertTeacherEligible({
    database: input.database,
    teacherId: input.teacherId,
    date: input.effectiveDate,
  });
  const next = classRow.teacherAssignments[0]?.effectiveDate;
  const through = next
    ? new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10)
    : dateOnly(classRow.semester.endDate);
  const profile = await input.database.teacherProfile.findUnique({
    where: { userId: input.teacherId },
    select: { departureDate: true },
  });
  const targetMeetings = (
    await meetingsBetween({
      database: input.database,
      from: input.effectiveDate,
      through,
      now: input.now,
    })
  ).filter(
    (row) =>
      row.classId === input.classId &&
      row.editable &&
      !row.substituteTeacherId &&
      (!profile?.departureDate || new Date(row.date) < profile.departureDate),
  );
  if (input.effectiveDate <= through) {
    await assertNoTeacherConflict({
      database: input.database,
      teacherId: input.teacherId,
      from: input.effectiveDate,
      through,
      slots: classRow.scheduleSlots.map(databaseSlotToCandidate),
      candidateMeetings: targetMeetings,
      excludeClassId: classRow.id,
    });
  }
  await freezeStartedMeetings({
    database: input.database,
    classId: input.classId,
    effectiveDate: input.effectiveDate,
    now: input.now,
  });
  await input.database.classSubstitution.updateMany({
    where: {
      classId: input.classId,
      OR: targetMeetings.map((row) => ({
        scheduleSlotId: row.slotId,
        ...(row.slotId ? {} : { classSessionId: row.sessionId }),
        date: new Date(row.date),
      })),
      revokedAt: { not: null },
      coverageResolvedAt: null,
    },
    data: { coverageResolvedAt: input.now },
  });
  await input.database.classTeacherAssignment.updateMany({
    where: {
      classId: input.classId,
      effectiveDate: utcDate(input.effectiveDate),
      supersededAt: null,
    },
    data: { supersededAt: input.now },
  });
  await input.database.classTeacherAssignment.create({
    data: {
      classId: input.classId,
      teacherId: input.teacherId,
      effectiveDate: utcDate(input.effectiveDate),
      recordedById: input.recordedById,
    },
  });
}

export async function substituteMeeting(input: {
  database: Database;
  classId: string;
  slotId: string | null;
  sessionId: string | null;
  date: string;
  teacherId: string;
  recordedById: string;
  now: Date;
}): Promise<void> {
  if (input.date < saoPauloDateOnly(input.now))
    throw badRequest("Não é possível alterar um encontro passado.");
  await lockTeacher(input.database, input.teacherId);
  await input.database
    .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${meetingKey(input)}, 158))`;
  await assertTeacherEligible({
    database: input.database,
    teacherId: input.teacherId,
    date: input.date,
  });
  const rows = await meetingsBetween({
    database: input.database,
    from: input.date,
    through: input.date,
    now: input.now,
  });
  const meeting = rows.find(
    (row) =>
      row.classId === input.classId &&
      (input.slotId ? row.slotId === input.slotId : row.sessionId === input.sessionId),
  );
  if (!meeting) throw badRequest("Encontro inexistente ou cancelado nesta data.");
  if (!meeting.editable)
    throw badRequest("Este encontro já começou ou possui registros e não pode ser alterado.");
  if (
    meeting.substituteTeacherId ||
    (meeting.usualTeacherId === input.teacherId && !meeting.requiresCoverage)
  )
    throw badRequest("Encontro já atribuído a este professor ou a um substituto.");
  await assertNoTeacherConflict({
    database: input.database,
    teacherId: input.teacherId,
    from: input.date,
    through: input.date,
    slots: [
      { weekday: weekdayOf(input.date), startTime: meeting.startTime, endTime: meeting.endTime },
    ],
    excludeMeeting: {
      classId: input.classId,
      slotId: input.slotId,
      sessionId: input.sessionId,
      date: input.date,
    },
  });
  await input.database.classSubstitution.create({
    data: {
      classId: input.classId,
      scheduleSlotId: input.slotId,
      classSessionId: input.slotId ? null : input.sessionId,
      date: utcDate(input.date),
      teacherId: input.teacherId,
      recordedById: input.recordedById,
    },
  });
}
