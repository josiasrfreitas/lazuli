import { TRPCError } from "@trpc/server";
import type { ClassRecordSave, ClassRecordSnapshot } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { usualTeacherOn } from "../teachers/responsibility.js";
import {
  dateOnly,
  loadRecordSession,
  lockClassRecord,
  responsibleTeacher,
  storedSnapshot,
  writeRestriction,
  type RecordContext,
  type RecordSession,
} from "./data.js";
import { initialSnapshot } from "./planned.js";
import { closeAttendanceWindows } from "../student-attendance/data.js";
export async function saveClassRecord(context: RecordContext, input: ClassRecordSave) {
  await lockClassRecord(context.database, input.sessionId);
  const session = await loadRecordSession(context, input.sessionId);
  const restriction = writeRestriction(context, session);
  if (restriction) throw badRequest(restriction);
  if (
    (session.classRecord?.version ?? 0) !== input.version ||
    (session.attendanceLastCommittedAt?.toISOString() ?? null) !== input.attendanceStamp
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "O registro mudou. Atualize a página antes de salvar novamente.",
    });
  const previous = storedSnapshot(session);
  const before = previous ?? (await initialSnapshot(context, session));
  const snapshot = mergeRecord(before, input, session);
  const changedConfirmedAttendance =
    !previous &&
    Boolean(session.attendanceConfirmedAt) &&
    before.entries.some(
      (row) =>
        snapshot.entries.find((next) => next.enrollmentId === row.enrollmentId)?.status !==
        row.status,
    );
  if (changedConfirmedAttendance && !input.reason)
    throw badRequest("Informe o motivo para corrigir a chamada já confirmada.");
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot))
    throw badRequest("Altere a presença, o conteúdo ou a observação antes de salvar uma correção.");
  await commitAttendance(context, session, snapshot);
  const closedWindows = await closeAttendanceWindows(
    context.database,
    session.id,
    context.staffUser.id,
    context.now,
  );
  if (closedWindows > 0)
    await recordActivity(context.database, context, "studentAttendance.close", {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description:
        "Recebimento de presença encerrado na baixa da aula. Envios recebidos preservados.",
    });
  const version = input.version + (changedConfirmedAttendance ? 2 : 1);
  const record = session.classRecord
    ? await context.database.classSessionRecord.update({
        where: { id: session.classRecord.id },
        data: { version, snapshot, updatedAt: context.now },
      })
    : await context.database.classSessionRecord.create({
        data: {
          classSessionId: session.id,
          teachingTeacherId: responsibleTeacher(session)?.id ?? null,
          version,
          snapshot,
          createdAt: context.now,
          updatedAt: context.now,
        },
      });
  if (changedConfirmedAttendance)
    await context.database.classSessionRecordRevision.create({
      data: {
        recordId: record.id,
        version: 1,
        snapshot: before,
        reason: "Chamada anterior à baixa, preservada antes da correção de presença.",
        recordedById: context.staffUser.id,
        createdAt: context.now,
        updatedAt: context.now,
      },
    });
  const reason =
    input.reason ??
    (session.attendanceConfirmedAt
      ? "Baixa da aula com frequência anteriormente confirmada."
      : "Baixa da aula e confirmação da chamada.");
  await context.database.classSessionRecordRevision.create({
    data: {
      recordId: record.id,
      version,
      snapshot,
      reason,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      updatedAt: context.now,
    },
  });
  const present = snapshot.entries.filter((row) => row.status === "PRESENT").length;
  await recordActivity(
    context.database,
    context,
    input.version ? "classRecords.correct" : "classRecords.confirm",
    {
      subject: { type: "class", id: session.classId, name: session.class.portalClassName },
      description: `${dateOnly(session.date).split("-").reverse().join("/")} · ${present} presentes, ${snapshot.entries.length - present} faltas. ${reason}`,
    },
  );
  return { id: record.id, version };
}
function mergeRecord(
  base: ClassRecordSnapshot,
  input: ClassRecordSave,
  session: RecordSession,
): ClassRecordSnapshot {
  const requested = new Map(input.rows.map((row) => [row.enrollmentId, row]));
  if (
    requested.size !== input.rows.length ||
    requested.size !== base.entries.length ||
    base.entries.some((row) => !requested.has(row.enrollmentId))
  )
    throw badRequest("A lista de alunos mudou. Atualize a chamada antes de confirmar.");
  const regular = session.class.scheduleType === "REGULAR";
  const entries = base.entries.map((row) => {
    const next = requested.get(row.enrollmentId)!;
    if ((regular || next.status === "ABSENT") && next.content)
      throw badRequest("Registre conteúdo individual somente para alunos presentes no PPT.");
    if (!regular && next.status === "PRESENT" && !next.content)
      throw badRequest(`Descreva o realizado para ${row.name}.`);
    return { ...row, status: next.status, content: next.content };
  });
  const present = entries.filter((row) => row.status === "PRESENT").length;
  if (regular && present > 0 && !input.sharedContent)
    throw badRequest("Descreva o conteúdo realizado pela turma.");
  if ((!regular || present === 0) && input.sharedContent)
    throw badRequest("O conteúdo compartilhado pertence às aulas regulares com presentes.");
  if (present === 0 && !input.note?.trim())
    throw badRequest("Registre uma observação para a aula sem alunos presentes.");
  return { ...base, note: input.note, sharedContent: input.sharedContent, entries };
}
async function commitAttendance(
  context: RecordContext,
  session: RecordSession,
  snapshot: ClassRecordSnapshot,
) {
  const current = await context.database.attendance.findMany({
    where: { classSessionId: session.id, deletedAt: null },
    select: { id: true, enrollmentId: true, status: true },
  });
  const ids = new Set(snapshot.entries.map((row) => row.enrollmentId));
  if (current.some((row) => !ids.has(row.enrollmentId)))
    throw badRequest(
      "A frequência registrada diverge da matrícula histórica. Revise a movimentação antes de dar baixa.",
    );
  for (const row of snapshot.entries) {
    const existing = current.find((entry) => entry.enrollmentId === row.enrollmentId);
    if (!existing)
      await context.database.attendance.create({
        data: {
          classSessionId: session.id,
          enrollmentId: row.enrollmentId,
          status: row.status,
          recordedAt: context.now,
          recordedById: context.staffUser.id,
        },
      });
    else if (existing.status !== row.status)
      await context.database.attendance.update({
        where: { id: existing.id },
        data: {
          status: row.status,
          lastModifiedAt: context.now,
          lastModifiedById: context.staffUser.id,
        },
      });
  }
  await context.database.classSession.update({
    where: { id: session.id },
    data: {
      ...(!session.responsibilityFrozenAt
        ? {
            usualTeacherId: usualTeacherOn(session.class, session.date)?.id ?? null,
            responsibilityFrozenAt: context.now,
          }
        : {}),
      ...(!session.attendanceConfirmedAt
        ? { attendanceConfirmedAt: context.now, attendanceConfirmedById: context.staffUser.id }
        : {}),
      attendanceLastCommittedAt: context.now,
    },
  });
}
