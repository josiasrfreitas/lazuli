import { createHash, createHmac } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import type { AttendanceLocation } from "@lazuli/validators";
import type { RosterCandidate } from "./types.js";
import { badRequest } from "../trpc/errors.js";
import { dateOnly, type RecordSession } from "../class-records/data.js";
const MINUTE_MS = 60_000;
const PRE_CLASS_MINUTES = 30;
const LOCATION_MAX_AGE_MS = 2 * MINUTE_MS;
export const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
/** The projection capability derives the current student token; neither token is persisted. */
export const windowToken = (projectionToken: string, windowId: string): string =>
  createHmac("sha256", projectionToken)
    .update(`student-attendance:${windowId}`)
    .digest("base64url");
export function openingRestriction(session: RecordSession, now: Date): string | null {
  if (session.status === "CANCELLED") return "Aula cancelada: o link está indisponível.";
  if (session.attendanceConfirmedAt || session.classRecord)
    return "A chamada já foi confirmada pelo professor.";
  const start = sessionEndInstant({ date: session.date, endTime: session.startTime });
  if (
    dateOnly(session.date) !== saoPauloDateOnly(now) ||
    now.getTime() < start.getTime() - PRE_CLASS_MINUTES * MINUTE_MS
  )
    return "O link abre no dia da aula, a partir de 30 minutos antes do início.";
  if (now >= sessionEndInstant(session))
    return "O prazo de envio terminou com a aula. A presença pode ser registrada pelo professor.";
  return null;
}
export function assertFreshLocation(location: AttendanceLocation, now: Date): void {
  const age = now.getTime() - new Date(location.capturedAt).getTime();
  if (age > LOCATION_MAX_AGE_MS || age < -MINUTE_MS)
    throw badRequest("Atualize a localização e tente novamente.");
}
export async function declarationRoster(
  database: Prisma.TransactionClient,
  input: { classId: string; date: Date },
): Promise<RosterCandidate[]> {
  const { classId, date } = input;
  const rows = await database.enrollment.findMany({
    where: {
      classId,
      deletedAt: null,
      entryDate: { lte: date },
      OR: [{ exitDate: null }, { exitDate: { gt: date } }],
      student: { deletedAt: null },
    },
    select: { id: true, student: { select: { fullName: true, phone: true } } },
    orderBy: [{ student: { fullName: "asc" } }, { id: "asc" }],
  });
  return rows.map((row) => ({ id: row.id, name: row.student.fullName, phone: row.student.phone }));
}
/** Caller holds the shared encounter lock; closing the attendance call revokes all QR windows. */
export async function closeAttendanceWindows(
  database: Prisma.TransactionClient,
  input: { sessionId: string; userId: string; now: Date },
): Promise<number> {
  const { sessionId, userId, now } = input;
  const closed = await database.attendanceWindow.updateMany({
    where: { classSessionId: sessionId, closedAt: null, deletedAt: null },
    data: { closedAt: now, closedById: userId, updatedAt: now },
  });
  return closed.count;
}

export type AttendanceClock = { now: Date; clock?: () => Date };
/** Refresh after acquiring the encounter lock; requests may have waited across a deadline. */
export function refreshAttendanceClock<Context extends AttendanceClock>(context: Context): Context {
  return { ...context, now: context.clock?.() ?? context.now };
}
