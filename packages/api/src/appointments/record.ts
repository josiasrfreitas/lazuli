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

type RecordTarget = { row: AppointmentRow; correcting: boolean; teacherId: string };

export async function recordAppointment(
  context: AppointmentContext,
  input: AppointmentRecordInput,
): Promise<{ id: string; version: number }> {
  await lockTeacher(context.database, "");
  const { row, correcting, teacherId } = await recordTarget(context, input);
  await validateCoverages(context, {
    studentId: row.studentId,
    appointmentId: row.id,
    purpose: row.purpose,
    date: row.date,
    startTime: row.startTime,
    maximumMinutes: input.attended ? input.performedMinutes! : 0,
    coverages: input.coverages,
  });
  await persistRecording(context, { row, input, teacherId });
  const saved = await recordAppointmentRevision(context, {
    id: row.id,
    kind: correcting ? "CORRECTED" : "RECORDED",
    reason: input.reason || null,
  });
  await synchronizeLegacyMakeup(context, saved);
  await recordActivity(context, { saved, input, correcting });
  return { id: saved.id, version: saved.version };
}

async function recordTarget(
  context: AppointmentContext,
  input: AppointmentRecordInput,
): Promise<RecordTarget> {
  const initial = await loadAppointment(context, input.id);
  // Serialize the destination with cancellation and the dated class-record responsibility freeze.
  if (initial.targetClassSessionId)
    await lockClassRecord(context.database, initial.targetClassSessionId);
  const row = await loadAppointment(context, input.id);
  assertAppointmentVersion(row, input.expectedVersion);
  const restriction = appointmentRestriction(context, row);
  if (restriction) throw badRequest(restriction);
  const correcting = row.status !== "SCHEDULED";
  if (!correcting) await requireCurrentEnrollment(context, row.studentId);
  assertRecordingDetails(row, { input, correcting });
  const teacher = appointmentTeacher(row);
  if (!teacher) throw badRequest("O atendimento está sem professor responsável.");
  return { row, correcting, teacherId: teacher.id };
}

function assertRecordingDetails(
  row: AppointmentRow,
  { input, correcting }: { input: AppointmentRecordInput; correcting: boolean },
): void {
  if (correcting && !input.reason) throw badRequest("Explique o motivo da correção.");
  if (input.attended && (!input.performedContent.trim() || !input.performedMinutes))
    throw badRequest("Informe o conteúdo e os minutos realizados.");
  if (!input.attended && input.coverages.length > 0)
    throw badRequest("Sem comparecimento não há compensação.");
  assertMakeupCoverage(row, { input, correcting });
}

function assertMakeupCoverage(
  row: AppointmentRow,
  { input, correcting }: { input: AppointmentRecordInput; correcting: boolean },
): void {
  if (
    input.attended &&
    row.purpose === "MAKEUP" &&
    (!correcting || row.version === 0) &&
    input.coverages.length === 0
  )
    throw badRequest("Associe a falta de origem antes de confirmar a reposição.");
}

async function persistRecording(
  context: AppointmentContext,
  {
    row,
    input,
    teacherId,
  }: { row: AppointmentRow; input: AppointmentRecordInput; teacherId: string },
): Promise<void> {
  await preserveImportedAppointment(context, row);
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

async function recordActivity(
  context: AppointmentContext,
  {
    saved,
    input,
    correcting,
  }: {
    saved: Awaited<ReturnType<typeof recordAppointmentRevision>>;
    input: AppointmentRecordInput;
    correcting: boolean;
  },
): Promise<void> {
  const compensated = input.coverages.reduce((sum, item) => sum + item.minutes, 0);
  await appointmentActivity(context, {
    row: saved,
    action: correcting ? "appointments.correct" : "appointments.record",
    description: `${input.attended ? `Compareceu · ${input.performedMinutes} minutos realizados${compensated ? ` · ${compensated} minutos compensados` : ""}.` : "Não compareceu. Reservas de compensação liberadas."}${input.reason ? ` ${input.reason}` : ""}`,
  });
}
