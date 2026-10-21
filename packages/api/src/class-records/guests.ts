import { responsibleTeacher, timeOnly, type RecordContext, type RecordSession } from "./data.js";
import { sessionEndInstant } from "@lazuli/domain";

/** Guests attend a meeting without belonging to its roster on that date. */
export async function sessionGuests(context: RecordContext, sessions: RecordSession[]) {
  if (sessions.length === 0) return new Map<string, { appointments: never[]; leads: never[] }>();
  const dates = sessions
    .map((session) => session.date)
    .toSorted((left, right) => left.getTime() - right.getTime());
  const [appointments, visits, enrollments] = await Promise.all([
    context.database.pedagogicalAppointment.findMany({
      where: {
        targetClassSessionId: { in: sessions.map((session) => session.id) },
        deletedAt: null,
        status: { not: "CANCELLED" },
        student: { deletedAt: null },
      },
      select: {
        id: true,
        targetClassSessionId: true,
        purpose: true,
        status: true,
        student: { select: { id: true, fullName: true } },
      },
      orderBy: { student: { fullName: "asc" } },
    }),
    context.database.entryVisit.findMany({
      where: {
        classId: { in: sessions.map((session) => session.classId) },
        date: { gte: dates[0]!, lte: dates.at(-1)! },
        kind: "TRIAL",
        status: { not: "CANCELLED" },
        deletedAt: null,
        candidate: { deletedAt: null },
      },
      select: {
        id: true,
        classId: true,
        classSessionId: true,
        scheduleSlotId: true,
        date: true,
        startTime: true,
        endTime: true,
        format: true,
        status: true,
        candidate: {
          select: {
            id: true,
            fullName: true,
            studentId: true,
            scheduleType: true,
            stage: { select: { name: true } },
          },
        },
      },
      orderBy: { candidate: { fullName: "asc" } },
    }),
    context.database.enrollment.findMany({
      where: {
        classId: { in: sessions.map((session) => session.classId) },
        deletedAt: null,
        entryDate: { lte: dates.at(-1)! },
        OR: [{ exitDate: null }, { exitDate: { gt: dates[0]! } }],
      },
      select: { classId: true, studentId: true, entryDate: true, exitDate: true },
    }),
  ]);
  return new Map(
    sessions.map((session) => {
      const members = new Set(
        enrollments
          .filter(
            (row) =>
              row.classId === session.classId &&
              row.entryDate <= session.date &&
              (!row.exitDate || row.exitDate > session.date),
          )
          .map((row) => row.studentId),
      );
      return [
        session.id,
        {
          appointments: appointments.filter(
            (row) => row.targetClassSessionId === session.id && !members.has(row.student.id),
          ),
          leads: visits
            .filter(
              (row) =>
                row.classId === session.classId &&
                row.date.getTime() === session.date.getTime() &&
                (row.classSessionId === session.id ||
                  (!row.classSessionId &&
                    row.scheduleSlotId !== null &&
                    row.scheduleSlotId === session.scheduleSlotId)) &&
                (!row.candidate.studentId || !members.has(row.candidate.studentId)),
            )
            .map((row) => ({
              ...row,
              startTime: timeOnly(row.startTime),
              endTime: timeOnly(row.endTime),
              teacher: responsibleTeacher(session),
              overdue: row.status === "SCHEDULED" && sessionEndInstant(row) <= context.now,
              className: session.class.portalClassName,
            })),
        },
      ];
    }),
  );
}

export type SessionGuestSet =
  Awaited<ReturnType<typeof sessionGuests>> extends Map<string, infer Group> ? Group : never;
export type SessionLeadGuest = SessionGuestSet["leads"][number];
