import type { Prisma, CalendarReconciliationRequest } from "@lazuli/db";
import { academicActivityCanBeCancelled } from "@lazuli/domain";
import { generateClassSessions } from "../sessions/generate.js";
import { cancelCalendarAppointment } from "./appointments.js";
const ISO_DATE_LENGTH = 10;
const civil = (value: Date): string => value.toISOString().slice(0, ISO_DATE_LENGTH);
const classWindow = { semesterId: true, startDate: true, status: true } as const;
const sessionInclude = {
  class: { select: classWindow },
  classRecord: { select: { id: true } },
  _count: {
    select: { attendanceRows: true, attendanceDeclarations: true, attendanceWindows: true },
  },
} satisfies Prisma.ClassSessionInclude;

const appointmentInclude = {
  targetClassSession: { select: { class: { select: classWindow } } },
} as const;
const visitInclude = {
  class: { select: classWindow },
  assessment: { select: { visitId: true } },
} as const;
type Session = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;
type Appointment = Prisma.PedagogicalAppointmentGetPayload<{ include: typeof appointmentInclude }>;
type Visit = Prisma.EntryVisitGetPayload<{ include: typeof visitInclude }>;
type Period = { id: string; startDate: Date; endDate: Date };
type ReconciliationRows = [{ date: Date }[], Period[], Session[], Appointment[], Visit[]];
type ReconciliationInput = { request: CalendarReconciliationRequest; now: Date };
type Counts = {
  cancelledSessions: number;
  cancelledAppointments: number;
  cancelledVisits: number;
  generatedSessions: number;
};
type ClassWindow = Session["class"];
type BlockedDate = (date: Date, target?: ClassWindow | null) => boolean;
export async function reconcileCalendar(
  database: Prisma.TransactionClient,
  input: ReconciliationInput,
): Promise<Counts> {
  const { request, now } = input;
  const [closedDays, periods, sessions, appointments, visits] = await readReconciliationRows(
    database,
    request,
  );
  const closed = new Set(closedDays.map((row) => civil(row.date)));
  const outside = (id: string, date: Date): boolean =>
    !periods.some(
      (period) => period.id === id && period.startDate <= date && period.endDate >= date,
    );
  const blocked: BlockedDate = (date, target): boolean =>
    closed.has(civil(date)) ||
    Boolean(
      target &&
      request.semesterId === target.semesterId &&
      (outside(target.semesterId, date) ||
        target.status === "ARCHIVED" ||
        (target.startDate && date < target.startDate)),
    );
  const cancelledAppointments = await cancelAppointments(database, {
    appointments,
    blocked,
    request,
    now,
  });
  const cancelledVisits = await cancelVisits(database, { visits, periods, blocked, request, now });
  const cancelledSessions = await cancelSessions(database, { sessions, blocked, request, now });
  const generatedSessions = await generateCalendarSessions(database, { periods, request, now });
  return { cancelledSessions, cancelledAppointments, cancelledVisits, generatedSessions };
}
async function readReconciliationRows(
  database: Prisma.TransactionClient,
  request: CalendarReconciliationRequest,
): Promise<ReconciliationRows> {
  const range = { gte: request.fromDate, lte: request.throughDate };
  return Promise.all([
    database.schoolClosedDay.findMany({
      where: { date: range, deletedAt: null },
      select: { date: true },
    }),
    database.period.findMany({
      where: { deletedAt: null },
      select: { id: true, startDate: true, endDate: true },
    }),
    database.classSession.findMany({
      where: {
        date: range,
        status: "SCHEDULED",
        deletedAt: null,
        ...(request.semesterId ? { class: { semesterId: request.semesterId } } : {}),
      },
      include: sessionInclude,
      orderBy: { id: "asc" },
    }),
    database.pedagogicalAppointment.findMany({
      where: { date: range, status: "SCHEDULED", deletedAt: null },
      include: appointmentInclude,
    }),
    database.entryVisit.findMany({
      where: { date: range, status: "SCHEDULED", deletedAt: null },
      include: visitInclude,
    }),
  ]);
}
async function cancelAppointments(
  database: Prisma.TransactionClient,
  input: ReconciliationInput & { appointments: Appointment[]; blocked: BlockedDate },
): Promise<number> {
  const { appointments, blocked, request, now } = input;
  let cancelledAppointments = 0;
  for (const row of appointments)
    if (blocked(row.date, row.targetClassSession?.class))
      cancelledAppointments += await cancelCalendarAppointment(database, {
        id: row.id,
        request,
        now,
      });
  return cancelledAppointments;
}
async function cancelVisits(
  database: Prisma.TransactionClient,
  input: ReconciliationInput & { visits: Visit[]; periods: Period[]; blocked: BlockedDate },
): Promise<number> {
  const { visits, periods, blocked, request, now } = input;
  let cancelledVisits = 0;
  for (const row of visits)
    if (
      (blocked(row.date, row.class) ||
        (request.semesterId &&
          !row.class &&
          !periods.some((period) => period.startDate <= row.date && period.endDate >= row.date))) &&
      academicActivityCanBeCancelled({ ...row, recorded: Boolean(row.assessment), now })
    ) {
      await database.entryVisit.update({
        where: { id: row.id },
        data: {
          status: "CANCELLED",
          cancellationReason: request.reason,
          recordedById: request.requestedById,
        },
      });
      cancelledVisits++;
    }
  return cancelledVisits;
}
async function cancelSessions(
  database: Prisma.TransactionClient,
  input: ReconciliationInput & { sessions: Session[]; blocked: BlockedDate },
): Promise<number> {
  const { sessions, blocked, request, now } = input;
  let cancelledSessions = 0;
  for (const original of sessions) {
    if (!sessionBlocked(original, blocked)) continue;
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`class-record:${original.id}`},0))`;
    const row = await database.classSession.findUniqueOrThrow({
      where: { id: original.id },
      include: sessionInclude,
    });
    if (
      !academicActivityCanBeCancelled({
        ...row,
        recorded: sessionRecorded(row),
        now,
      })
    )
      continue;
    await database.classSession.update({
      where: { id: row.id },
      data: {
        status: "CANCELLED",
        cancelReason: request.reason,
        cancelledAt: now,
        cancelledById: request.requestedById,
      },
    });
    cancelledSessions++;
  }
  return cancelledSessions;
}
function sessionBlocked(session: Session, blocked: BlockedDate): boolean {
  // Explicit extras keep their dates across period edits. Dissolution ends the class calendar.
  if (session.class.status === "ARCHIVED") return true;
  return blocked(session.date, session.appointmentSeriesId ? undefined : session.class);
}
function sessionRecorded(row: Session): boolean {
  return Boolean(
    row.classRecord ||
    row.attendanceConfirmedAt ||
    row.attendanceLastCommittedAt ||
    row.portalSubmittedAt ||
    row._count.attendanceRows ||
    row._count.attendanceDeclarations ||
    row._count.attendanceWindows,
  );
}
async function generateCalendarSessions(
  database: Prisma.TransactionClient,
  input: ReconciliationInput & { periods: Period[] },
): Promise<number> {
  const { periods, request, now } = input;
  let generatedSessions = 0;
  for (const period of periods.filter((row) =>
    request.semesterId
      ? row.id === request.semesterId
      : row.startDate <= request.throughDate && row.endDate >= request.fromDate,
  )) {
    const generated = await generateClassSessions({
      database,
      payload: { semesterId: period.id },
      notBefore: now,
      dateWindow: { from: request.fromDate, through: request.throughDate },
    });
    generatedSessions += generated.sessionsCreated;
  }
  return generatedSessions;
}
