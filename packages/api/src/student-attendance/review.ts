import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import type { attendanceReviewSchema, z } from "@lazuli/validators";
import { recordActivity } from "../activity/record.js";
import { commitAttendance } from "../class-records/attendance.js";
import {
  assertAttendanceOnlyWrite,
  dateOnly,
  loadRecordSession,
  lockClassRecord,
  type RecordContext,
  type RecordSession,
} from "../class-records/data.js";
import { badRequest } from "../trpc/errors.js";
import { closeAttendanceWindows, declarationRoster } from "./data.js";

export function attendanceReviewRestriction(
  context: RecordContext,
  session: RecordSession,
): string | null {
  if (session.status === "CANCELLED") return "Esta aula foi cancelada.";
  if (session.classRecord)
    return "A aula já tem um registro completo. Use Corrigir registro para alterar a presença.";
  if (
    context.staffUser.role === "TEACHER" &&
    dateOnly(session.date) !== saoPauloDateOnly(context.now)
  )
    return "A chamada pode ser confirmada no dia da aula. Para aulas anteriores, use Registrar aula.";
  if (sessionEndInstant({ date: session.date, endTime: session.startTime }) > context.now)
    return "Você pode confirmar a chamada a partir do início da aula.";
  return null;
}

export async function confirmAttendanceReview(
  context: RecordContext,
  input: z.infer<typeof attendanceReviewSchema>,
): Promise<{ attendanceStamp: string; present: number; absent: number }> {
  await lockClassRecord(context.database, input.sessionId);
  const session = await loadRecordSession(context, input.sessionId);
  await assertAttendanceOnlyWrite(context.database, input.sessionId);
  const restriction = attendanceReviewRestriction(context, session);
  if (restriction) throw badRequest(restriction);
  if ((session.attendanceLastCommittedAt?.toISOString() ?? null) !== input.attendanceStamp)
    throw new TRPCError({
      code: "CONFLICT",
      message: "A chamada foi alterada em outra tela. Atualize a lista antes de confirmar.",
    });

  const roster = await declarationRoster(context.database, {
    classId: session.classId,
    date: session.date,
  });
  assertRosterMatches(
    input.rows.map((row) => row.enrollmentId),
    roster.map((row) => row.id),
  );

  await assertNoUnseenDeclarations(context, {
    sessionId: session.id,
    declarationIds: input.declarationIds,
  });

  await commitAttendance(context, { session, entries: input.rows });
  await closeAttendanceWindows(context.database, {
    sessionId: session.id,
    userId: context.staffUser.id,
    now: context.now,
  });
  const present = input.rows.filter((row) => row.status === "PRESENT").length;
  await recordActivity(context.database, {
    context,
    action: session.attendanceConfirmedAt ? "attendance.editSession" : "attendance.confirmSession",
    details: {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description: `${dateOnly(session.date).split("-").toReversed().join("/")} · ${present} presentes, ${roster.length - present} faltas. Chamada conferida pelo professor; recebimento por QR e link encerrado.`,
    },
  });
  return { attendanceStamp: context.now.toISOString(), present, absent: roster.length - present };
}

async function assertNoUnseenDeclarations(
  context: RecordContext,
  { sessionId, declarationIds }: { sessionId: string; declarationIds: string[] },
): Promise<void> {
  const unseen = await context.database.attendanceDeclaration.count({
    where: {
      classSessionId: sessionId,
      deletedAt: null,
      id: { notIn: declarationIds },
    },
  });
  if (unseen)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Chegou uma nova presença. Confira a lista atualizada e confirme novamente.",
    });
}

function assertRosterMatches(requestedIds: string[], rosterIds: string[]): void {
  const requested = new Set(requestedIds);
  if (
    requested.size !== requestedIds.length ||
    requested.size !== rosterIds.length ||
    rosterIds.some((id) => !requested.has(id))
  )
    throw badRequest("A lista de alunos mudou. Atualize a chamada antes de confirmar.");
}
