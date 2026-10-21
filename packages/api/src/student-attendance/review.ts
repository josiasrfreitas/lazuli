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

export function attendanceReviewRestriction(context: RecordContext, session: RecordSession) {
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
  const requested = new Set(input.rows.map((row) => row.enrollmentId));
  if (
    requested.size !== input.rows.length ||
    requested.size !== roster.length ||
    roster.some((row) => !requested.has(row.id))
  )
    throw badRequest("A lista de alunos mudou. Atualize a chamada antes de confirmar.");

  const unseen = await context.database.attendanceDeclaration.count({
    where: {
      classSessionId: session.id,
      deletedAt: null,
      id: { notIn: input.declarationIds },
    },
  });
  if (unseen)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Chegou uma nova presença. Confira a lista atualizada e confirme novamente.",
    });

  await commitAttendance(context, { session, entries: input.rows });
  await closeAttendanceWindows(context.database, {
    sessionId: session.id,
    userId: context.staffUser.id,
    now: context.now,
  });
  const present = input.rows.filter((row) => row.status === "PRESENT").length;
  await recordActivity(
    context.database,
    context,
    session.attendanceConfirmedAt ? "attendance.editSession" : "attendance.confirmSession",
    {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description: `${dateOnly(session.date).split("-").toReversed().join("/")} · ${present} presentes, ${roster.length - present} faltas. Chamada conferida pelo professor; recebimento por QR e link encerrado.`,
    },
  );
  return { attendanceStamp: context.now.toISOString(), present, absent: roster.length - present };
}
