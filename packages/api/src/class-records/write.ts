import { closeAttendanceWindows } from "../student-attendance/data.js";
import { TRPCError } from "@trpc/server";
import type { ClassRecordSave, ClassRecordSnapshot } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { assertAttendanceWriteWindow } from "../attendance/access.js";
import { preserveAttendance } from "./attendance-origin.js";
import { resolveRecordedSteps } from "./planning-links.js";
import { commitAttendance } from "./attendance.js";
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
import type { VersionedResult } from "./types.js";
type RecordState = {
  session: RecordSession;
  before: ClassRecordSnapshot;
  snapshot: ClassRecordSnapshot;
  changedAttendance: boolean;
};

export async function saveClassRecord(
  context: RecordContext,
  input: ClassRecordSave,
): Promise<VersionedResult> {
  await lockClassRecord(context.database, input.sessionId);
  const state = await prepareRecord(context, input);
  await commitAttendance(context, { session: state.session, entries: state.snapshot.entries });
  const closed = await closeAttendanceWindows(context.database, {
    sessionId: state.session.id,
    userId: context.staffUser.id,
    now: context.now,
  });
  if (closed)
    await recordActivity(context.database, context, "studentAttendance.close", {
      subject: {
        type: "class",
        id: state.session.classId,
        name: state.session.class.portalClassName,
      },
      description: "Encerrou o recebimento de declarações ao confirmar o registro da aula.",
    });
  const result = await persistRecord(context, { input, state });
  await recordActivity(
    context.database,
    context,
    input.version ? "classRecords.correct" : "classRecords.confirm",
    {
      subject: {
        type: "class",
        id: state.session.classId,
        name: state.session.class.portalClassName,
      },
      description: recordDescription(input, state),
    },
  );
  return result;
}
async function prepareRecord(context: RecordContext, input: ClassRecordSave): Promise<RecordState> {
  const session = await loadRecordSession(context, input.sessionId);
  const restriction = writeRestriction(context, session);
  if (restriction) throw badRequest(restriction);
  assertCurrentVersion(session, input);
  await assertDeclarationsReviewed(context, { session, input });
  const previous = storedSnapshot(session);
  const before = previous ?? (await initialSnapshot(context, session));
  const snapshot = mergeRecord(before, { input, session });
  await resolveRecordedSteps(context, { session, snapshot, previous });
  const changedAttendance =
    !previous &&
    Boolean(session.attendanceConfirmedAt) &&
    before.entries.some(
      (row) =>
        snapshot.entries.find((next) => next.enrollmentId === row.enrollmentId)?.status !==
        row.status,
    );
  const state = { session, before, snapshot, changedAttendance };
  await prepareAttendance(context, { state, priorRecord: Boolean(previous) });
  if (changedAttendance && !input.reason)
    throw badRequest("Informe o motivo para corrigir a chamada já confirmada.");
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot))
    throw badRequest("Altere a presença, o conteúdo ou a observação antes de salvar uma correção.");
  return state;
}
async function prepareAttendance(
  context: RecordContext,
  values: { state: RecordState; priorRecord: boolean },
): Promise<void> {
  const { state, priorRecord } = values;
  if (state.changedAttendance)
    assertAttendanceWriteWindow({
      staffUser: context.staffUser,
      sessionDate: state.session.date,
      now: context.now,
    });
  if (!priorRecord && state.session.attendanceConfirmedAt) {
    const origin = await preserveAttendance(context, state.session);
    state.before.attendanceOrigin = origin;
    state.snapshot.attendanceOrigin = { ...origin, priorState: false };
  }
}
async function assertDeclarationsReviewed(
  context: RecordContext,
  values: { session: RecordSession; input: ClassRecordSave },
): Promise<void> {
  const { session, input } = values;
  if (
    !session.classRecord &&
    !input.qrReviewed &&
    (await context.database.attendanceWindow.count({ where: { classSessionId: session.id } }))
  )
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Esta chamada passou a receber declarações. Atualize o registro e confira a presença novamente.",
    });
  const unseen = await context.database.attendanceDeclaration.count({
    where: {
      classSessionId: session.id,
      deletedAt: null,
      id: { notIn: input.declarationIds ?? [] },
    },
  });
  if (!session.classRecord && unseen)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Chegou uma nova declaração. Atualize o registro e confira a chamada novamente.",
    });
}
function assertCurrentVersion(session: RecordSession, input: ClassRecordSave): void {
  if (
    (session.classRecord?.version ?? 0) !== input.version ||
    (session.attendanceLastCommittedAt?.toISOString() ?? null) !== input.attendanceStamp
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "O registro mudou. Atualize a página antes de salvar novamente.",
    });
}
async function persistRecord(
  context: RecordContext,
  values: { input: ClassRecordSave; state: RecordState },
): Promise<VersionedResult> {
  const { input, state } = values;
  const { session, snapshot } = state;
  const version = input.version + (state.changedAttendance ? 2 : 1);
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
  if (state.changedAttendance)
    await createRevision(context, {
      recordId: record.id,
      version: 1,
      snapshot: state.before,
      recordedById: state.before.attendanceOrigin?.confirmedBy?.id ?? context.staffUser.id,
      createdAt: session.attendanceConfirmedAt ?? context.now,
      reason: "Chamada anterior à baixa, preservada antes da correção de presença.",
    });
  await createRevision(context, {
    recordId: record.id,
    version,
    snapshot,
    reason: revisionReason(input, session),
  });
  return { id: record.id, version };
}
async function createRevision(
  context: RecordContext,
  input: {
    recordId: string;
    version: number;
    snapshot: ClassRecordSnapshot;
    reason: string;
    recordedById?: string;
    createdAt?: Date;
  },
): Promise<void> {
  await context.database.classSessionRecordRevision.create({
    data: {
      ...input,
      recordedById: input.recordedById ?? context.staffUser.id,
      createdAt: input.createdAt ?? context.now,
      updatedAt: context.now,
    },
  });
}
function revisionReason(input: ClassRecordSave, session: RecordSession): string {
  return (
    input.reason ??
    (session.attendanceConfirmedAt
      ? "Baixa da aula com frequência anteriormente confirmada."
      : "Baixa da aula e confirmação da chamada.")
  );
}
function recordDescription(input: ClassRecordSave, state: RecordState): string {
  const present = state.snapshot.entries.filter((row) => row.status === "PRESENT").length;
  return `${dateOnly(state.session.date).split("-").toReversed().join("/")} · ${present} presentes, ${state.snapshot.entries.length - present} faltas. ${revisionReason(input, state.session)}`;
}
function mergeRecord(
  base: ClassRecordSnapshot,
  values: { input: ClassRecordSave; session: RecordSession },
): ClassRecordSnapshot {
  const { input, session } = values;
  const requested = new Map(input.rows.map((row) => [row.enrollmentId, row]));
  if (
    requested.size !== input.rows.length ||
    requested.size !== base.entries.length ||
    base.entries.some((row) => !requested.has(row.enrollmentId))
  )
    throw badRequest("A lista de alunos mudou. Atualize a chamada antes de confirmar.");
  const regular = session.class.scheduleType === "REGULAR";
  const entries = base.entries.map((row) =>
    mergeEntry(row, { next: requested.get(row.enrollmentId)!, regular }),
  );
  assertContent({ regular, entries, input });
  return { ...base, entries, note: input.note || null, sharedContent: input.sharedContent };
}
function mergeEntry(
  row: ClassRecordSnapshot["entries"][number],
  values: { next: ClassRecordSave["rows"][number]; regular: boolean },
): ClassRecordSnapshot["entries"][number] {
  const { next, regular } = values;
  if ((regular || next.status === "ABSENT") && next.content)
    throw badRequest("Registre conteúdo individual somente para alunos presentes no PPT.");
  if (!regular && next.status === "PRESENT" && !next.content)
    throw badRequest(`Descreva o realizado para ${row.name}.`);
  return { ...row, status: next.status, content: next.content };
}
function assertContent(values: {
  regular: boolean;
  entries: ClassRecordSnapshot["entries"];
  input: ClassRecordSave;
}): void {
  const { regular, entries, input } = values;
  const present = entries.filter((row) => row.status === "PRESENT").length;
  if (regular && present > 0 && !input.sharedContent)
    throw badRequest("Descreva o conteúdo realizado pela turma.");
  if ((!regular || present === 0) && input.sharedContent)
    throw badRequest("O conteúdo compartilhado pertence às aulas regulares com presentes.");
  if (present === 0 && !input.note)
    throw badRequest("Registre uma observação para a aula sem presentes.");
}
