import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { appointmentSnapshotSchema, type appointmentListSchema, type z } from "@lazuli/validators";
import {
  dateOnly,
  recordSessionInclude,
  responsibleTeacher,
  timeOnly,
} from "../class-records/data.js";
import { notFound } from "../trpc/errors.js";
import {
  appointmentInclude,
  appointmentRestriction,
  appointmentTeacher,
  canReadAppointment,
  loadAppointment,
  requireAppointmentAdmin,
  type AppointmentContext,
} from "./data.js";
import { appointmentSnapshot } from "./snapshot.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { studentAbsences } from "./absences.js";

export async function listAppointments(
  context: AppointmentContext,
  input: z.infer<typeof appointmentListSchema>,
) {
  return readAppointments(context, {
    where: {
      deletedAt: null,
      date: { gte: new Date(input.from), lte: new Date(input.through) },
      ...(input.studentId ? { studentId: input.studentId } : {}),
    },
    teacherId: input.teacherId,
  });
}
export async function studentAppointments(context: AppointmentContext, studentId: string) {
  return readAppointments(context, { where: { deletedAt: null, studentId } });
}
async function readAppointments(
  context: AppointmentContext,
  options: {
    where: Prisma.PedagogicalAppointmentWhereInput;
    teacherId?: string | undefined;
  },
) {
  const rows = await context.database.pedagogicalAppointment.findMany({
    where: options.where,
    include: appointmentInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows
    .filter(
      (row) =>
        canReadAppointment(context, row) &&
        (!options.teacherId || appointmentTeacher(row)?.id === options.teacherId),
    )
    .map((row) => ({
      ...appointmentSnapshot(row),
      restriction: appointmentRestriction(context, row),
      destinationCancelled: row.targetClassSession?.status === "CANCELLED",
      overdue: row.status === "SCHEDULED" && sessionEndInstant(row) <= context.now,
      rescheduledToId: row.rescheduledTo?.id ?? null,
    }));
}
export async function appointmentDetail(context: AppointmentContext, id: string) {
  const row = await loadAppointment(context, id);
  const [absences, revisions] = await Promise.all([
    studentAbsences(context.database, { studentId: row.studentId, excludeAppointmentId: row.id }),
    context.database.appointmentRevision.findMany({
      where: { appointmentId: row.id },
      orderBy: { version: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    snapshot: appointmentSnapshot(row),
    restriction: appointmentRestriction(context, row),
    rescheduledToId: row.rescheduledTo?.id ?? null,
    absences,
    history: revisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      author: revision.actor,
      at: revision.recordedAt,
      kind: revision.kind,
      reason: revision.reason,
      snapshot: appointmentSnapshotSchema.parse(revision.snapshot),
    })),
  };
}
export async function appointmentStudentOptions(
  context: AppointmentContext,
  options: {
    studentId: string;
    excludeAppointmentId?: string | undefined;
  },
) {
  const { studentId, excludeAppointmentId } = options;

  requireAppointmentAdmin(context);
  const student = await context.database.student.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  const [absences, enrollments] = await Promise.all([
    studentAbsences(context.database, { studentId, excludeAppointmentId }),
    context.database.enrollment.findMany({
      where: { studentId, deletedAt: null },
      include: {
        class: {
          select: {
            portalClassName: true,
            scheduleType: true,
            status: true,
            deletedAt: true,
            ...responsibilitySelect,
          },
        },
      },
      orderBy: { entryDate: "desc" },
    }),
  ]);
  const currentDate = saoPauloDateOnly(context.now);
  const currentEnrollment = enrollments.find(
    (row) =>
      row.class.deletedAt === null &&
      row.class.status === "ACTIVE" &&
      dateOnly(row.entryDate) <= currentDate &&
      (row.exitDate === null || dateOnly(row.exitDate) > currentDate),
  );
  return {
    student,
    hasCurrentEnrollment: enrollments.some(
      (row) =>
        row.class.deletedAt === null &&
        dateOnly(row.entryDate) <= currentDate &&
        (row.exitDate === null || dateOnly(row.exitDate) > currentDate),
    ),
    defaultTeacher: currentEnrollment
      ? usualTeacherOn(currentEnrollment.class, new Date(currentDate))
      : null,
    absences,
    enrollments: enrollments.map((row) => ({
      id: row.id,
      className: row.class.portalClassName,
      scheduleType: row.class.scheduleType,
      entryDate: dateOnly(row.entryDate),
      exitDate: row.exitDate ? dateOnly(row.exitDate) : null,
    })),
  };
}
export async function appointmentDestinations(
  context: AppointmentContext,
  options: {
    date: string;
    through?: string | undefined;
  },
) {
  const { date, through = date } = options;

  requireAppointmentAdmin(context);
  const sessions = await context.database.classSession.findMany({
    where: {
      date: { gte: new Date(date), lte: new Date(through) },
      deletedAt: null,
      status: "SCHEDULED",
      class: { deletedAt: null, status: "ACTIVE" },
    },
    include: recordSessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { classId: "asc" }],
  });
  return sessions
    .filter(
      (session) =>
        sessionEndInstant({ date: session.date, endTime: session.startTime }) > context.now &&
        responsibleTeacher(session),
    )
    .map((session) => ({
      id: session.id,
      date: dateOnly(session.date),
      classId: session.classId,
      name: session.class.portalClassName,
      startTime: timeOnly(session.startTime),
      endTime: timeOnly(session.endTime),
      teacher: responsibleTeacher(session),
      format: session.class.format,
      scheduleType: session.class.scheduleType,
    }));
}
