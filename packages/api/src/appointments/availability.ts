import { responsibleTeacherId, weekDates } from "@lazuli/domain";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { meetingKey, meetingsBetween } from "../teachers/schedule.js";
import { requireAppointmentAdmin, type AppointmentContext } from "./data.js";

/** Up to seven consecutive days; omitted through retains the legacy Monday–Sunday range. */
export async function appointmentAvailability(
  context: AppointmentContext,
  input: {
    teacherId: string;
    studentId: string;
    week: string;
    through?: string;
    excludeAppointmentId?: string;
  },
) {
  requireAppointmentAdmin(context);
  const { database } = context;
  const days = weekDates(input.week);
  const from = input.through ? input.week : days[0]!;
  const through = input.through ?? days[6]!;
  const range = { gte: new Date(from), lte: new Date(through) };
  const [meetings, enrollments, appointments, visits, closedDays, sessions] = await Promise.all([
    meetingsBetween({ database, from, through, now: context.now }),
    database.enrollment.findMany({
      where: {
        studentId: input.studentId,
        deletedAt: null,
        entryDate: { lte: range.lte },
        OR: [{ exitDate: null }, { exitDate: { gt: range.gte } }],
      },
      select: { classId: true, entryDate: true, exitDate: true },
    }),
    database.pedagogicalAppointment.findMany({
      where: {
        date: range,
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        OR: [
          { teacherId: input.teacherId, targetClassSessionId: null },
          { studentId: input.studentId },
        ],
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        teacherId: true,
        studentId: true,
        targetClassSessionId: true,
      },
    }),
    database.entryVisit.findMany({
      where: {
        date: range,
        deletedAt: null,
        status: { not: "CANCELLED" },
        OR: [
          { teacherId: input.teacherId, kind: "INTRODUCTION" },
          { candidate: { studentId: input.studentId } },
        ],
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        teacherId: true,
        kind: true,
        candidate: { select: { studentId: true } },
      },
    }),
    database.schoolClosedDay.findMany({
      where: { date: range, deletedAt: null },
      select: { date: true, reason: true },
    }),
    database.classSession.findMany({
      where: {
        date: range,
        status: "SCHEDULED",
        deletedAt: null,
        class: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true },
    }),
  ]);
  const availableSessions = new Set(sessions.map((row) => row.id));
  const teacherMeetings = meetings.filter(
    (row) => !row.cancelled && responsibleTeacherId(row) === input.teacherId,
  );
  const studentMeetings = meetings.filter(
    (row) =>
      !row.cancelled &&
      enrollments.some(
        (enrollment) =>
          enrollment.classId === row.classId &&
          dateOnly(enrollment.entryDate) <= row.date &&
          (!enrollment.exitDate || dateOnly(enrollment.exitDate) > row.date),
      ),
  );
  const intervals = (row: { id: string; date: Date; startTime: Date; endTime: Date }) => ({
    id: row.id,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
  });
  return {
    classes: teacherMeetings.map((row) => ({
      id: row.sessionId ?? meetingKey(row),
      sessionId: row.sessionId,
      classId: row.classId,
      className: row.className,
      scheduleType: row.scheduleType,
      stageName: row.stageName,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      format: row.format,
      selectable: Boolean(row.editable && row.sessionId && availableSessions.has(row.sessionId)),
    })),
    teacherBusy: [
      ...appointments
        .filter((row) => row.teacherId === input.teacherId && !row.targetClassSessionId)
        .map((row) => ({ ...intervals(row), label: "Atendimento" })),
      ...visits
        .filter((row) => row.teacherId === input.teacherId && row.kind === "INTRODUCTION")
        .map((row) => ({ ...intervals(row), label: "Experimental individual" })),
    ],
    studentBusy: [
      ...studentMeetings.map((row) => ({
        id: row.sessionId ?? meetingKey(row),
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        label: `Aula do aluno · ${row.className}`,
      })),
      ...appointments
        .filter((row) => row.studentId === input.studentId)
        .map((row) => ({ ...intervals(row), label: "Outro atendimento do aluno" })),
      ...visits
        .filter((row) => row.candidate.studentId === input.studentId)
        .map((row) => ({ ...intervals(row), label: "Aula experimental do aluno" })),
    ],
    closedDays: closedDays.map((row) => ({ date: dateOnly(row.date), reason: row.reason })),
  };
}
