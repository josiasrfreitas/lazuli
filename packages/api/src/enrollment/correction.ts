import { createHash } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type {
  enrollmentCorrectionApplyInputSchema,
  enrollmentCorrectionPreviewInputSchema,
  z,
} from "@lazuli/validators";
import { dateOnlyUtc } from "./effective-date.js";
import { badRequest, notFound } from "../trpc/errors.js";

type Database = Pick<
  Prisma.TransactionClient,
  "enrollmentAction" | "enrollment" | "pedagogicalProgress" | "classSession" | "attendance"
>;
type PreviewInput = z.infer<typeof enrollmentCorrectionPreviewInputSchema>;
type ApplyInput = z.infer<typeof enrollmentCorrectionApplyInputSchema>;
type Input = { database: Database; values: PreviewInput; now: Date };
const actionSelect = {
  id: true,
  kind: true,
  status: true,
  updatedAt: true,
  enrollmentId: true,
  enrollment: {
    select: {
      id: true,
      classId: true,
      entryDate: true,
      exitDate: true,
      exitReason: true,
      updatedAt: true,
      deletedAt: true,
      returnActions: {
        where: { kind: "RETURN", status: { in: ["SCHEDULED", "APPLIED"] } },
        select: {
          id: true,
          updatedAt: true,
          enrollment: { select: { entryDate: true, updatedAt: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  },
  sourceEnrollment: { select: { exitDate: true, updatedAt: true } },
} satisfies Prisma.EnrollmentActionSelect;
const sessionSelect = {
  id: true,
  date: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.ClassSessionSelect;
const attendanceSelect = {
  id: true,
  classSessionId: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.AttendanceSelect;
type Action = Prisma.EnrollmentActionGetPayload<{ select: typeof actionSelect }>;
type Session = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;
type Attendance = Prisma.AttendanceGetPayload<{ select: typeof attendanceSelect }>;
type Snapshot = {
  action: Action;
  oldDate: Date;
  newDate: Date;
  sessions: Session[];
  attendance: Attendance[];
  version: string;
};
function assertCorrectable(action: Action): void {
  if (action.status !== "APPLIED")
    throw badRequest("Somente uma ação já efetivada pode ser corrigida.");
  if (action.kind === "CORRECTION" || action.enrollment.deletedAt !== null)
    throw badRequest("Somente uma ação já efetivada pode ser corrigida.");
}
function assertDateBounds(input: {
  action: Action;
  oldDate: Date;
  newDate: Date;
  now: Date;
  isEntry: boolean;
}): void {
  const oldDay = dateOnlyUtc(input.oldDate);
  const newDay = dateOnlyUtc(input.newDate);
  if (newDay >= saoPauloDateOnly(input.now)) throw badRequest("A correção deve ter data passada.");
  if (newDay === oldDay) throw badRequest("Informe uma data diferente da registrada.");
  if (!input.isEntry && newDay < dateOnlyUtc(input.action.enrollment.entryDate))
    throw badRequest("A saída não pode anteceder a entrada.");
  const exitDate = input.action.enrollment.exitDate;
  if (input.isEntry && exitDate !== null && newDay > dateOnlyUtc(exitDate))
    throw badRequest("A entrada não pode ser posterior à saída.");
  assertLinkedChronology(input.action, newDay);
}
function assertLinkedChronology(action: Action, newDay: string): void {
  if (action.kind === "RETURN") {
    const pauseDate = action.sourceEnrollment?.exitDate;
    if (pauseDate === null || pauseDate === undefined || newDay < dateOnlyUtc(pauseDate))
      throw badRequest("O retorno não pode anteceder a pausa de origem.");
  }
  if (
    action.kind === "PAUSE" &&
    action.enrollment.returnActions.some(
      (linked) => newDay > dateOnlyUtc(linked.enrollment.entryDate),
    )
  ) {
    throw badRequest("A pausa não pode ser posterior ao retorno vinculado.");
  }
}
function validateChange(input: { action: Action; newDate: Date; now: Date }): {
  oldDate: Date;
  start: Date;
  end: Date;
} {
  const { action, newDate, now } = input;
  assertCorrectable(action);
  const isEntry = action.kind === "ENTRY" || action.kind === "RETURN";
  const oldDate = isEntry ? action.enrollment.entryDate : action.enrollment.exitDate;
  if (oldDate === null) throw badRequest("A ação ainda não foi efetivada.");
  assertDateBounds({ action, oldDate, newDate, now, isEntry });
  const before = dateOnlyUtc(oldDate) < dateOnlyUtc(newDate);
  return { oldDate, start: before ? oldDate : newDate, end: before ? newDate : oldDate };
}
async function affectedRecords(input: {
  database: Database;
  action: Action;
  window: { start: Date; end: Date };
}): Promise<{ sessions: Session[]; attendance: Attendance[] }> {
  const { database, action, window } = input;
  const sessions = await database.classSession.findMany({
    where: {
      classId: action.enrollment.classId,
      deletedAt: null,
      date: { gte: window.start, lt: window.end },
    },
    select: sessionSelect,
    orderBy: { date: "asc" },
  });
  const attendance = await database.attendance.findMany({
    where: {
      enrollmentId: action.enrollmentId,
      deletedAt: null,
      classSessionId: { in: sessions.map((session) => session.id) },
    },
    select: attendanceSelect,
  });
  return { sessions, attendance };
}
function snapshotVersion(input: {
  action: Action;
  sessions: Session[];
  attendance: Attendance[];
}): string {
  const { action, sessions, attendance } = input;
  return createHash("sha256")
    .update(
      JSON.stringify({
        action: action.updatedAt,
        enrollment: action.enrollment.updatedAt,
        source: action.sourceEnrollment,
        linkedReturns: action.enrollment.returnActions.map((linked) => [
          linked.id,
          linked.updatedAt,
          linked.enrollment.entryDate,
          linked.enrollment.updatedAt,
        ]),
        sessions: sessions.map(({ id, updatedAt }) => [id, updatedAt]),
        attendance: attendance.map(({ id, updatedAt }) => [id, updatedAt]),
      }),
    )
    .digest("hex");
}
async function snapshot(input: Input): Promise<Snapshot> {
  const action = await input.database.enrollmentAction.findUnique({
    where: { id: input.values.actionId },
    select: actionSelect,
  });
  if (action === null) throw notFound("Registro da ação não encontrado.");
  const window = validateChange({ action, newDate: input.values.effectiveDate, now: input.now });
  const { sessions, attendance } = await affectedRecords({
    database: input.database,
    action,
    window,
  });
  return {
    action,
    oldDate: window.oldDate,
    newDate: input.values.effectiveDate,
    sessions,
    attendance,
    version: snapshotVersion({ action, sessions, attendance }),
  };
}
export type CorrectionPreview = {
  actionId: string;
  kind: Action["kind"];
  oldDate: Date;
  newDate: Date;
  classSessions: Array<Pick<Session, "id" | "date" | "status">>;
  attendance: Array<Pick<Attendance, "id" | "classSessionId" | "status">>;
  version: string;
};
export async function previewEnrollmentCorrection(input: Input): Promise<CorrectionPreview> {
  const current = await snapshot(input);
  return {
    actionId: current.action.id,
    kind: current.action.kind,
    oldDate: current.oldDate,
    newDate: current.newDate,
    classSessions: current.sessions.map(({ id, date, status }) => ({ id, date, status })),
    attendance: current.attendance.map(({ id, classSessionId, status }) => ({
      id,
      classSessionId,
      status,
    })),
    version: current.version,
  };
}
export async function applyEnrollmentCorrection(input: {
  database: Database;
  values: ApplyInput;
  staffUserId: string;
  now: Date;
}): Promise<{ id: string }> {
  const current = await snapshot(input);
  if (current.version !== input.values.expectedVersion)
    throw badRequest("Os registros mudaram. Revise a prévia novamente.");
  const isEntry = current.action.kind === "ENTRY" || current.action.kind === "RETURN";
  const enrollmentId = current.action.enrollmentId;
  const progress = await input.database.pedagogicalProgress.findFirst({
    where: { enrollmentId, deletedAt: null, ...(isEntry ? {} : { endDate: { not: null } }) },
    orderBy: isEntry ? { startDate: "asc" } : { endDate: "desc" },
    select: { id: true },
  });
  if (progress === null) throw badRequest("O percurso pedagógico do vínculo não foi encontrado.");
  await input.database.enrollment.update({
    where: { id: enrollmentId },
    data: isEntry ? { entryDate: current.newDate } : { exitDate: current.newDate },
  });
  await input.database.pedagogicalProgress.update({
    where: { id: progress.id },
    data: isEntry ? { startDate: current.newDate } : { endDate: current.newDate },
  });
  const correction = await input.database.enrollmentAction.create({
    data: {
      enrollmentId,
      kind: "CORRECTION",
      status: "APPLIED",
      effectiveDate: current.newDate,
      previousDate: current.oldDate,
      correctionOfId: current.action.id,
      justification: input.values.justification,
      recordedById: input.staffUserId,
    },
    select: { id: true },
  });
  return { id: correction.id };
}
