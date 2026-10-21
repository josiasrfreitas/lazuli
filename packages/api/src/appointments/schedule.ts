import { TRPCError } from "@trpc/server";
import { teachingMinutes } from "@lazuli/domain";
import type { AppointmentScheduleInput } from "@lazuli/validators";
import { timeOnly } from "../class-records/data.js";
import { lockTeacher } from "../teachers/availability.js";
import { badRequest } from "../trpc/errors.js";
import { requireAppointmentAdmin, type AppointmentContext } from "./data.js";
import { validateCoverages } from "./coverage.js";
import { resolveAppointmentMeeting } from "./scheduling.js";
import { appointmentActivity, recordAppointmentRevision } from "./evidence.js";

export async function scheduleAppointment(
  context: AppointmentContext,
  input: AppointmentScheduleInput,
  rescheduledFromId?: string,
  legacyMakeupId?: string,
): Promise<{ id: string; version: number }> {
  requireAppointmentAdmin(context);
  await lockTeacher(context.database, "");
  if (await context.database.pedagogicalAppointment.findUnique({ where: { id: input.id } }))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este agendamento já foi salvo. Atualize a agenda.",
    });
  if (input.purpose === "MAKEUP" && input.coverages.length === 0)
    throw badRequest("Selecione pelo menos uma falta de origem.");
  if (input.purpose === "PPT_COMPLEMENT" && !input.enrollmentId)
    throw badRequest("Selecione a matrícula PPT.");
  const { student: _student, ...meeting } = await resolveAppointmentMeeting(context, input);
  await validateCoverages(context, {
    ...meeting,
    studentId: input.studentId,
    appointmentId: input.id,
    purpose: input.purpose,
    coverages: input.coverages,
    maximumMinutes: teachingMinutes({
      startTime: timeOnly(meeting.startTime),
      endTime: timeOnly(meeting.endTime),
    }),
  });
  await context.database.pedagogicalAppointment.create({
    data: {
      id: input.id,
      studentId: input.studentId,
      enrollmentId: input.enrollmentId,
      purpose: input.purpose,
      ...meeting,
      plannedContent: input.plannedContent || null,
      notes: input.notes || null,
      scheduledAt: context.now,
      scheduledById: context.staffUser.id,
      ...(rescheduledFromId ? { rescheduledFromId } : {}),
      ...(legacyMakeupId ? { legacyMakeupId } : {}),
      coverages: { create: input.coverages },
    },
  });
  const row = await recordAppointmentRevision(context, input.id, "SCHEDULED", null);
  await appointmentActivity(
    context,
    row,
    "appointments.schedule",
    `${row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · ${timeOnly(row.startTime)}–${timeOnly(row.endTime)}. ${input.coverages.length > 0 ? `${input.coverages.reduce((sum, item) => sum + item.minutes, 0)} minutos reservados para reposição.` : "Acompanhamento pedagógico agendado."}`,
  );
  return { id: row.id, version: row.version };
}
