import type { RecordContext, RecordSession } from "./data.js";
import type { ClassRecordGuest } from "./types.js";

/** A guest participates without becoming a member of the class roster. */
export async function sessionAppointmentGuests(
  context: RecordContext,
  sessions: RecordSession[],
): Promise<Map<string, ClassRecordGuest[]>> {
  if (sessions.length === 0) return new Map();
  const dates = sessions
    .map((session) => session.date)
    .toSorted((left, right) => left.getTime() - right.getTime());
  const [appointments, enrollments] = await Promise.all([
    findSessionAppointments(context, sessions),
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
        appointments.filter(
          (row) => row.targetClassSessionId === session.id && !members.has(row.student.id),
        ),
      ];
    }),
  );
}

function findSessionAppointments(
  context: RecordContext,
  sessions: RecordSession[],
): Promise<ClassRecordGuest[]> {
  return context.database.pedagogicalAppointment.findMany({
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
  });
}
