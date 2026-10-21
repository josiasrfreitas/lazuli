import type { AppointmentResult } from "./view-types.js";
import { requireCurrentEnrollment } from "../enrollment/require-current.js";
import type { AppointmentRecordInput } from "@lazuli/validators";
import { lockClassRecord } from "../class-records/data.js";
import { lockTeacher } from "../teachers/availability.js";
import { badRequest } from "../trpc/errors.js";
import {
  appointmentRestriction,
  appointmentTeacher,
  loadAppointment,
  type AppointmentContext,
  type AppointmentRow,
} from "./data.js";
import { validateCoverages } from "./coverage.js";
import {
  appointmentActivity,
  assertAppointmentVersion,
  preserveImportedAppointment,
  recordAppointmentRevision,
  synchronizeLegacyMakeup,
} from "./evidence.js";
export async function recordAppointment(
  context: AppointmentContext,
  input: AppointmentRecordInput,
): Promise<AppointmentResult> {
  await lockTeacher(context.database, "");
  const initial = await loadAppointment(context, input.id);
  // Serialize the destination with cancellation and the dated class-record responsibility freeze.
  if (initial.targetClassSessionId)
    await lockClassRecord(context.database, initial.targetClassSessionId);
  const row = await loadAppointment(context, input.id);
  assertAppointmentVersion(row, input.expectedVersion);
  const correcting = row.status !== "SCHEDULED";
  const teacher = await validateRecord(context, { row, input, correcting });
  await validateCoverages(context, {
    studentId: row.studentId,
    appointmentId: row.id,
    purpose: row.purpose,
    date: row.date,
    startTime: row.startTime,
    maximumMinutes: input.attended ? input.performedMinutes! : 0,
    coverages: input.coverages,
  });
  await preserveImportedAppointment(context, row);
  await saveCoverages(context, { row, input });
  await saveRecord(context, { row, input, teacherId: teacher.id });
  const saved = await recordAppointmentRevision(context, {
    id: row.id,
    kind: correcting ? "CORRECTED" : "RECORDED",
    reason: input.reason || null,
  });
  await synchronizeLegacyMakeup(context, saved);
  await appointmentActivity(context, {
    row: saved,
    action: correcting ? "appointments.correct" : "appointments.record",
    description: recordDescription(input),
  });
  return { id: saved.id, version: saved.version };
}

type RecordValues = { row: AppointmentRow; input: AppointmentRecordInput; correcting: boolean };
async function validateRecord(
  context: AppointmentContext,
  { row, input, correcting }: RecordValues,
): Promise<{ id: string; name: string }> {
  const restriction = appointmentRestriction(context, row);
  if (restriction) throw badRequest(restriction);
  if (!correcting) await requireCurrentEnrollment(context, row.studentId);
  if (correcting && !input.reason) throw badRequest("Explique o motivo da correção.");
  assertRecordContent(row, { input, correcting });
  const teacher = appointmentTeacher(row);
  if (!teacher) throw badRequest("O atendimento está sem professor responsável.");
  return teacher;
}
function assertRecordContent(
  row: AppointmentRow,
  { input, correcting }: Omit<RecordValues, "row">,
): void {
  if (input.attended && (!input.performedContent.trim() || !input.performedMinutes))
    throw badRequest("Informe o conteúdo e os minutos realizados.");
  if (!input.attended && input.coverages.length > 0)
    throw badRequest("Sem comparecimento não há compensação.");
  if (input.attended && requiresMakeupSource(row, correcting) && input.coverages.length === 0)
    throw badRequest("Associe a falta de origem antes de confirmar a reposição.");
}
async function saveCoverages(
  context: AppointmentContext,
  { row, input }: Omit<RecordValues, "correcting">,
): Promise<void> {
  await context.database.makeupCoverage.updateMany({
    where: {
      appointmentId: row.id,
      deletedAt: null,
      attendanceId: { notIn: input.coverages.map((item) => item.attendanceId) },
    },
    data: { deletedAt: context.now },
  });
  for (const coverage of input.coverages)
    await context.database.makeupCoverage.upsert({
      where: {
        appointmentId_attendanceId: { appointmentId: row.id, attendanceId: coverage.attendanceId },
      },
      create: { appointmentId: row.id, ...coverage },
      update: { minutes: coverage.minutes, deletedAt: null },
    });
}
function recordDescription(input: AppointmentRecordInput): string {
  const compensated = input.coverages.reduce((sum, item) => sum + item.minutes, 0);
  return `${input.attended ? `Compareceu · ${input.performedMinutes} minutos realizados${compensated ? ` · ${compensated} minutos compensados` : ""}.` : "Não compareceu. Reservas de compensação liberadas."}${input.reason ? ` ${input.reason}` : ""}`;
}

async function saveRecord(
  context: AppointmentContext,
  { row, input, teacherId }: Omit<RecordValues, "correcting"> & { teacherId: string },
): Promise<void> {
  await context.database.pedagogicalAppointment.update({
    where: { id: row.id },
    data: {
      version: { increment: 1 },
      status: input.attended ? "ATTENDED" : "NO_SHOW",
      teacherId,
      performedContent: input.attended ? input.performedContent : null,
      performedMinutes: input.attended ? input.performedMinutes : null,
      notes: input.notes || null,
      recordedAt: context.now,
      recordedById: context.staffUser.id,
    },
  });
}

function requiresMakeupSource(row: AppointmentRow, correcting: boolean): boolean {
  return row.purpose === "MAKEUP" && (!correcting || row.version === 0);
}
