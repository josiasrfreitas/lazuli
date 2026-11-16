import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { classRecordSnapshotSchema, type ClassRecordSnapshot } from "@lazuli/validators";
import { responsibilitySelect } from "../teachers/responsibility.js";
export { evidenceSessionTeacher as responsibleTeacher } from "@lazuli/db/appointment-evidence";
import { evidenceSessionTeacher as responsibleTeacher } from "@lazuli/db/appointment-evidence";
import { notFound, badRequest } from "../trpc/errors.js";
export type RecordContext = { database: Prisma.TransactionClient; staffUser: StaffUser; now: Date };
const DATE_ONLY_LENGTH = 10;
const TIME_START = 11;
const TIME_END = 16;
export const dateOnly = (date: Date): string => date.toISOString().slice(0, DATE_ONLY_LENGTH);
export const timeOnly = (date: Date): string => date.toISOString().slice(TIME_START, TIME_END);
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
    session.classRecord !== null &&
    dateOnly(session.date) !== saoPauloDateOnly(context.now)
  )
    return "A administração pode corrigir registros já encerrados em dias anteriores.";
  return null;
}
export async function loadRecordSession(
  context: RecordContext,
  sessionId: string,
): Promise<RecordSession> {
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
export function storedSnapshot(session: RecordSession): ClassRecordSnapshot | null {
  return session.classRecord ? classRecordSnapshotSchema.parse(session.classRecord.snapshot) : null;
}
export async function lockClassRecord(
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  sessionId: string,
): Promise<void> {
  const key = `class-record:${sessionId}`;
  await database.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked`;
}
/** Legacy attendance cannot bypass the attributed class-record correction. Shares the write lock. */
export async function assertAttendanceOnlyWrite(
  database: Pick<Prisma.TransactionClient, "$queryRaw" | "classSessionRecord" | "attendanceWindow">,
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
  if (await database.attendanceWindow.count({ where: { classSessionId: sessionId } }))
    throw badRequest(
      "Confira as declarações e confirme presença e conteúdo pelo registro da aula.",
    );
}
