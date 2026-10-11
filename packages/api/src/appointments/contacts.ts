import { saoPauloDateOnly } from "@lazuli/domain";
import type { absenceContactSchema, z } from "@lazuli/validators";
import { recordActivity } from "../activity/record.js";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  requireAppointmentAdmin,
  sourceApplicable,
  sourceInclude,
  type AppointmentContext,
} from "./data.js";

export async function recordAbsenceContact(
  context: AppointmentContext,
  input: z.infer<typeof absenceContactSchema>,
) {
  requireAppointmentAdmin(context);
  const student = await context.database.student.findFirst({
    where: { id: input.studentId, deletedAt: null },
    select: { fullName: true },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  const contactedAt = new Date(input.contactedAt);
  if (contactedAt > context.now) throw badRequest("O contato deve ter ocorrido antes do registro.");
  if (input.nextContactDate && input.nextContactDate < saoPauloDateOnly(contactedAt))
    throw badRequest("O próximo contato deve ser na mesma data ou depois do contato registrado.");
  if (input.attendanceId) {
    const source = await context.database.attendance.findUnique({
      where: { id: input.attendanceId },
      include: sourceInclude,
    });
    if (!source || source.enrollment.studentId !== input.studentId || !sourceApplicable(source))
      throw badRequest("Selecione uma falta confirmada deste aluno.");
  }
  const row = await context.database.absenceContact.create({
    data: {
      ...input,
      contactedAt,
      nextContactDate: input.nextContactDate ? new Date(input.nextContactDate) : null,
      actorId: context.staffUser.id,
      recordedAt: context.now,
    },
  });
  await recordActivity(context.database, context, "appointments.contact", {
    subject: { type: "student", id: input.studentId, name: student.fullName },
    description: input.notes,
    deduplicationKey: `appointments.contact:${row.id}`,
  });
  return { id: row.id };
}
