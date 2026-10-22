import type { Prisma } from "@lazuli/db";
import { sessionEndInstant } from "@lazuli/domain";
import { responsibleTeacher, timeOnly, type RecordContext, type RecordSession } from "./data.js";

const appointmentSelect = {
  id: true,
  targetClassSessionId: true,
  purpose: true,
  status: true,
  student: { select: { id: true, fullName: true } },
} satisfies Prisma.PedagogicalAppointmentSelect;
const visitSelect = {
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
} satisfies Prisma.EntryVisitSelect;
const enrollmentSelect = {
  classId: true,
  studentId: true,
  entryDate: true,
  exitDate: true,
} satisfies Prisma.EnrollmentSelect;

type GuestAppointment = Prisma.PedagogicalAppointmentGetPayload<{
  select: typeof appointmentSelect;
}>;
type GuestVisit = Prisma.EntryVisitGetPayload<{ select: typeof visitSelect }>;
type GuestEnrollment = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;
export type SessionLeadGuest = Omit<GuestVisit, "startTime" | "endTime"> & {
  startTime: string;
  endTime: string;
  teacher: ReturnType<typeof responsibleTeacher>;
  overdue: boolean;
  className: string;
};
export type SessionGuestSet = {
  appointments: GuestAppointment[];
  leads: SessionLeadGuest[];
};
type GuestWindow = { first: Date; last: Date; sessions: RecordSession[] };
type GuestRows = {
  appointments: GuestAppointment[];
  visits: GuestVisit[];
  enrollments: GuestEnrollment[];
  now: Date;
};

/** Guests attend a meeting without belonging to its roster on that date. */
export async function sessionGuests(
  context: RecordContext,
  sessions: RecordSession[],
): Promise<Map<string, SessionGuestSet>> {
  if (sessions.length === 0) return new Map<string, SessionGuestSet>();
  const dates = sessions
    .map((session) => session.date)
    .toSorted((left, right) => left.getTime() - right.getTime());
  const window = { first: dates[0]!, last: dates.at(-1)!, sessions };
  const [appointments, visits, enrollments] = await Promise.all([
    guestAppointments(context, sessions),
    guestVisits(context, window),
    guestEnrollments(context, window),
  ]);
  const rows = { appointments, visits, enrollments, now: context.now };
  return new Map(sessions.map((session) => [session.id, guestSet(session, rows)]));
}

async function guestAppointments(
  context: RecordContext,
  sessions: RecordSession[],
): Promise<GuestAppointment[]> {
  return context.database.pedagogicalAppointment.findMany({
    where: {
      targetClassSessionId: { in: sessions.map((session) => session.id) },
      deletedAt: null,
      status: { not: "CANCELLED" },
      student: { deletedAt: null },
    },
    select: appointmentSelect,
    orderBy: { student: { fullName: "asc" } },
  });
}

async function guestVisits(
  context: RecordContext,
  { first, last, sessions }: GuestWindow,
): Promise<GuestVisit[]> {
  return context.database.entryVisit.findMany({
    where: {
      classId: { in: sessions.map((session) => session.classId) },
      date: { gte: first, lte: last },
      kind: "TRIAL",
      status: { not: "CANCELLED" },
      deletedAt: null,
      candidate: { deletedAt: null },
    },
    select: visitSelect,
    orderBy: { candidate: { fullName: "asc" } },
  });
}

async function guestEnrollments(
  context: RecordContext,
  { first, last, sessions }: GuestWindow,
): Promise<GuestEnrollment[]> {
  return context.database.enrollment.findMany({
    where: {
      classId: { in: sessions.map((session) => session.classId) },
      deletedAt: null,
      entryDate: { lte: last },
      OR: [{ exitDate: null }, { exitDate: { gt: first } }],
    },
    select: enrollmentSelect,
  });
}

function memberIds(session: RecordSession, enrollments: GuestEnrollment[]): Set<string> {
  return new Set(
    enrollments
      .filter(
        (row) =>
          row.classId === session.classId &&
          row.entryDate <= session.date &&
          (!row.exitDate || row.exitDate > session.date),
      )
      .map((row) => row.studentId),
  );
}

function visitMatchesSession(
  row: GuestVisit,
  { session, members }: { session: RecordSession; members: Set<string> },
): boolean {
  return (
    row.classId === session.classId &&
    row.date.getTime() === session.date.getTime() &&
    (row.classSessionId === session.id ||
      (!row.classSessionId &&
        row.scheduleSlotId !== null &&
        row.scheduleSlotId === session.scheduleSlotId)) &&
    (!row.candidate.studentId || !members.has(row.candidate.studentId))
  );
}

function guestSet(session: RecordSession, rows: GuestRows): SessionGuestSet {
  const members = memberIds(session, rows.enrollments);
  return {
    appointments: rows.appointments.filter(
      (row) => row.targetClassSessionId === session.id && !members.has(row.student.id),
    ),
    leads: rows.visits
      .filter((row) => visitMatchesSession(row, { session, members }))
      .map((row) => ({
        ...row,
        startTime: timeOnly(row.startTime),
        endTime: timeOnly(row.endTime),
        teacher: responsibleTeacher(session),
        overdue: row.status === "SCHEDULED" && sessionEndInstant(row) <= rows.now,
        className: session.class.portalClassName,
      })),
  };
}
