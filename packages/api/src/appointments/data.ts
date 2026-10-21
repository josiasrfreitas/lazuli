import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import {
  recordSessionInclude,
  responsibleTeacher,
  dateOnly,
  type RecordContext,
} from "../class-records/data.js";
import { notFound } from "../trpc/errors.js";

export type AppointmentContext = RecordContext;
const personSelect = { id: true, name: true } as const;
export const sourceInclude = {
  enrollment: {
    include: {
      student: { select: { id: true, fullName: true } },
      class: { select: { id: true, portalClassName: true, scheduleType: true } },
    },
  },
  classSession: { include: recordSessionInclude },
} satisfies Prisma.AttendanceInclude;
export const appointmentInclude = {
  student: { select: { id: true, fullName: true } },
  teacher: { select: personSelect },
  scheduledBy: { select: personSelect },
  recordedBy: { select: personSelect },
  cancelledBy: { select: personSelect },
  targetClassSession: { include: recordSessionInclude },
  rescheduledTo: { select: { id: true } },
  coverages: {
    where: { deletedAt: null },
    include: { attendance: { include: sourceInclude } },
    orderBy: { attendanceId: "asc" },
  },
} satisfies Prisma.PedagogicalAppointmentInclude;
export type AppointmentRow = Prisma.PedagogicalAppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;
export type AbsenceSource = Prisma.AttendanceGetPayload<{ include: typeof sourceInclude }>;
export type AppointmentAssignment = Pick<
  AppointmentRow,
  "targetClassSession" | "recordedAt" | "teacher"
>;
export function appointmentTeacher(
  row: AppointmentAssignment,
): { id: string; name: string } | null {
  return row.targetClassSession && !row.recordedAt
    ? responsibleTeacher(row.targetClassSession)
    : row.teacher;
}
export function canReadAppointment(
  context: AppointmentContext,
  row: AppointmentAssignment,
): boolean {
  return (
    context.staffUser.role !== "TEACHER" || appointmentTeacher(row)?.id === context.staffUser.id
  );
}
export function appointmentRestriction(
  context: AppointmentContext,
  row: AppointmentRow,
): string | null {
  if (row.status === "CANCELLED")
    return row.rescheduledTo
      ? "Este atendimento foi reagendado. Consulte o novo agendamento."
      : "Este atendimento foi cancelado.";
  if (row.targetClassSession?.status === "CANCELLED")
    return "A aula de destino foi cancelada. Reagende o atendimento.";
  if (sessionEndInstant(row) > context.now)
    return "O registro fica disponível após o término do atendimento.";
  if (context.staffUser.role === "TEACHER" && dateOnly(row.date) !== saoPauloDateOnly(context.now))
    return "A administração pode registrar ou corrigir atendimentos de dias anteriores.";
  return null;
}
export function sourceApplicable(row: AbsenceSource): boolean {
  const session = row.classSession;
  return (
    !row.deletedAt &&
    row.status === "ABSENT" &&
    !session.deletedAt &&
    session.status !== "CANCELLED" &&
    Boolean(session.attendanceConfirmedAt) &&
    !row.enrollment.deletedAt &&
    row.enrollment.classId === session.classId &&
    row.enrollment.entryDate <= session.date &&
    (!row.enrollment.exitDate || row.enrollment.exitDate > session.date)
  );
}
export async function loadAppointment(
  context: AppointmentContext,
  id: string,
): Promise<AppointmentRow> {
  const row = await context.database.pedagogicalAppointment.findFirst({
    where: { id, deletedAt: null },
    include: appointmentInclude,
  });
  if (!row) throw notFound("Atendimento não encontrado.");
  if (!canReadAppointment(context, row))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este atendimento está disponível ao professor responsável.",
    });
  return row;
}
export function requireAppointmentAdmin(context: AppointmentContext): void {
  if (context.staffUser.role !== "ADMIN" && context.staffUser.role !== "SYSTEM_ADMIN")
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta operação é da administração." });
}
