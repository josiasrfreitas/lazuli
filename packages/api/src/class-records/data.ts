import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { classRecordSnapshotSchema } from "@lazuli/validators";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { notFound, badRequest } from "../trpc/errors.js";
export type RecordContext = { database: Prisma.TransactionClient; staffUser: StaffUser; now: Date };
export const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
export const timeOnly = (date: Date) => date.toISOString().slice(11, 16);
export const recordSessionInclude = {
  classRecord: { include: { teachingTeacher: { select: { id: true, name: true } } } },
  class: {
    select: {
      id: true,
      portalClassName: true,
      scheduleType: true,
      format: true,
      sharedStage: { select: { id: true, name: true } },
      ...responsibilitySelect,
      substitutions: {
        where: { revokedAt: null, deletedAt: null },
        orderBy: { recordedAt: "desc" },
        select: {
          teacherId: true,
          date: true,
          scheduleSlotId: true,
          classSessionId: true,
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ClassSessionInclude;
export type RecordSession = Prisma.ClassSessionGetPayload<{ include: typeof recordSessionInclude }>;
export function responsibleTeacher(session: RecordSession) {
  if (session.classRecord) return session.classRecord.teachingTeacher;
  const substitute = session.class.substitutions.find(
    (row) =>
      row.date.getTime() === session.date.getTime() &&
      (session.scheduleSlotId
        ? row.scheduleSlotId === session.scheduleSlotId
        : row.classSessionId === session.id),
  );
  if (substitute) return substitute.teacher;
  if (session.responsibilityFrozenAt) {
    const candidates = [
      session.class.teacher,
      ...session.class.teacherAssignments.map((row) => row.teacher),
    ];
    return candidates.find((row) => row.id === session.usualTeacherId) ?? null;
  }
  return usualTeacherOn(session.class, session.date);
}
export function canRead(context: RecordContext, session: RecordSession): boolean {
  return (
    context.staffUser.role !== "TEACHER" || responsibleTeacher(session)?.id === context.staffUser.id
  );
}
export function writeRestriction(context: RecordContext, session: RecordSession): string | null {
  if (session.status === "CANCELLED") return "Esta aula foi cancelada.";
  if (sessionEndInstant(session) > context.now)
    return "A baixa fica disponível após o término da aula.";
  if (
    context.staffUser.role === "TEACHER" &&
    dateOnly(session.date) !== saoPauloDateOnly(context.now)
  )
    return "A administração pode completar ou corrigir o registro de aulas de dias anteriores.";
  return null;
}
export async function loadRecordSession(context: RecordContext, sessionId: string) {
  const session = await context.database.classSession.findFirst({
    where: { id: sessionId, deletedAt: null, class: { deletedAt: null } },
    include: recordSessionInclude,
  });
  if (!session) throw notFound("Aula não encontrada.");
  if (!canRead(context, session))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta aula está disponível apenas ao professor responsável pelo encontro.",
    });
  return session;
}
export function storedSnapshot(session: RecordSession) {
  return session.classRecord ? classRecordSnapshotSchema.parse(session.classRecord.snapshot) : null;
}
export async function lockClassRecord(
  database: Prisma.TransactionClient,
  sessionId: string,
): Promise<void> {
  const key = `class-record:${sessionId}`;
  await database.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
}
/** Legacy attendance cannot bypass the attributed class-record correction. Shares the write lock. */
export async function assertAttendanceOnlyWrite(
  database: Prisma.TransactionClient,
  sessionId: string,
): Promise<void> {
  await lockClassRecord(database, sessionId);
  if (
    await database.classSessionRecord.findUnique({
      where: { classSessionId: sessionId },
      select: { id: true },
    })
  )
    throw badRequest("Corrija a presença pelo registro da aula, informando o motivo da alteração.");
}
