import type { appointmentCancelSchema, appointmentRescheduleSchema, z } from "@lazuli/validators";
import { lockTeacher } from "../teachers/availability.js";
import { badRequest } from "../trpc/errors.js";
import { loadAppointment, requireAppointmentAdmin, type AppointmentContext } from "./data.js";
import {
  appointmentActivity,
  assertAppointmentVersion,
  preserveImportedAppointment,
  recordAppointmentRevision,
  synchronizeLegacyMakeup,
} from "./evidence.js";
import { scheduleAppointment } from "./schedule.js";

export async function cancelAppointment(
  context: AppointmentContext,
  input: z.infer<typeof appointmentCancelSchema>,
  rescheduling = false,
) {
  requireAppointmentAdmin(context);
  await lockTeacher(context.database, "");
  const row = await loadAppointment(context, input.id);
  assertAppointmentVersion(row, input.expectedVersion);
  if (row.status !== "SCHEDULED")
    throw badRequest(
      "Somente atendimentos pendentes podem ser cancelados ou reagendados. Use a correção para um atendimento já registrado.",
    );
  await preserveImportedAppointment(context, row);
  await context.database.pedagogicalAppointment.update({
    where: { id: row.id },
    data: {
      status: "CANCELLED",
      cancelledAt: context.now,
      cancelledById: context.staffUser.id,
      cancellationReason: input.reason,
      version: { increment: 1 },
    },
  });
  const saved = await recordAppointmentRevision(
    context,
    row.id,
    rescheduling ? "RESCHEDULED" : "CANCELLED",
    input.reason,
  );
  await synchronizeLegacyMakeup(context, saved);
  await appointmentActivity(
    context,
    saved,
    rescheduling ? "appointments.reschedule" : "appointments.cancel",
    input.reason,
  );
  return { id: saved.id, version: saved.version };
}
export async function rescheduleAppointment(
  context: AppointmentContext,
  input: z.infer<typeof appointmentRescheduleSchema>,
) {
  requireAppointmentAdmin(context);
  await lockTeacher(context.database, "");
  const row = await loadAppointment(context, input.id);
  if (input.replacement.studentId !== row.studentId || input.replacement.purpose !== row.purpose)
    throw badRequest(
      "O reagendamento preserva o aluno e a finalidade. Para outra finalidade, cancele e crie um novo atendimento.",
    );
  await cancelAppointment(context, input, true);
  return scheduleAppointment(context, input.replacement, row.id);
}
