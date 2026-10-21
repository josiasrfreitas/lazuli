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
) {
  await lockTeacher(context.database, "");
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
  if (correcting && !input.reason) throw badRequest("Explique o motivo da correção.");
  if (input.attended && (!input.performedContent.trim() || !input.performedMinutes))
    throw badRequest("Informe o conteúdo e os minutos realizados.");
  if (!input.attended && input.coverages.length > 0)
    throw badRequest("Sem comparecimento não há compensação.");
  if (
    input.attended &&
    row.purpose === "MAKEUP" &&
    (!correcting || row.version === 0) &&
    input.coverages.length === 0
  )
    throw badRequest("Associe a falta de origem antes de confirmar a reposição.");
  const teacher = appointmentTeacher(row);
  if (!teacher) throw badRequest("O atendimento está sem professor responsável.");
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
      teacherId: teacher.id,
      performedContent: input.attended ? input.performedContent : null,
      performedMinutes: input.attended ? input.performedMinutes : null,
      notes: input.notes || null,
      recordedAt: context.now,
      recordedById: context.staffUser.id,
    },
  });
  const saved = await recordAppointmentRevision(
    context,
    row.id,
    correcting ? "CORRECTED" : "RECORDED",
    input.reason || null,
  );
  await synchronizeLegacyMakeup(context, saved);
  const compensated = input.coverages.reduce((sum, item) => sum + item.minutes, 0);
  await appointmentActivity(
    context,
    saved,
    correcting ? "appointments.correct" : "appointments.record",
    `${input.attended ? `Compareceu · ${input.performedMinutes} minutos realizados${compensated ? ` · ${compensated} minutos compensados` : ""}.` : "Não compareceu. Reservas de compensação liberadas."}${input.reason ? ` ${input.reason}` : ""}`,
  );
  return { id: saved.id, version: saved.version };
}
