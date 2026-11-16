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
  options: {
    input: AppointmentScheduleInput;
    rescheduledFromId?: string | undefined;
    legacyMakeupId?: string | undefined;
  },
): Promise<{ id: string; version: number }> {
  const { input, rescheduledFromId, legacyMakeupId } = options;

  requireAppointmentAdmin(context);
  await lockTeacher(context.database, "");
  await assertScheduleRequest(context, input);
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
  const row = await recordAppointmentRevision(context, {
    id: input.id,
    kind: "SCHEDULED",
    reason: null,
  });
  await recordScheduleActivity(context, { row, input });
  return { id: row.id, version: row.version };
}

async function recordScheduleActivity(
  context: AppointmentContext,
  {
    row,
    input,
  }: {
    row: Awaited<ReturnType<typeof recordAppointmentRevision>>;
    input: AppointmentScheduleInput;
  },
): Promise<void> {
  await appointmentActivity(context, {
    row,
    action: "appointments.schedule",
    description: `${input.meeting.kind === "INDEPENDENT" && input.meeting.academicExceptionDate ? "Atendimento extra fora do período acadêmico confirmado. " : ""}${row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · ${timeOnly(row.startTime)}–${timeOnly(row.endTime)}. ${input.coverages.length > 0 ? `${input.coverages.reduce((sum, item) => sum + item.minutes, 0)} minutos reservados para reposição.` : "Acompanhamento pedagógico agendado."}`,
  });
}

async function assertScheduleRequest(
  context: AppointmentContext,
  input: AppointmentScheduleInput,
): Promise<void> {
  if (await context.database.pedagogicalAppointment.findUnique({ where: { id: input.id } }))
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este agendamento já foi salvo. Atualize a agenda.",
    });
  if (input.purpose === "MAKEUP" && input.coverages.length === 0)
    throw badRequest("Selecione pelo menos uma falta de origem.");
  if (input.purpose === "PPT_COMPLEMENT" && !input.enrollmentId)
    throw badRequest("Selecione a matrícula PPT.");
}
