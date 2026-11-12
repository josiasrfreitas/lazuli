import type { DatabaseClient, Prisma, CalendarReconciliationRequest } from "@lazuli/db";
import { academicActivityCanBeCancelled } from "@lazuli/domain";
import { generateClassSessions } from "../sessions/generate.js";
import { cancelCalendarAppointment } from "./appointments.js";

const civil = (value: Date) => value.toISOString().slice(0, 10);
const sessionInclude = {
  class: { select: { semesterId: true } },
  classRecord: { select: { id: true } },
  _count: {
    select: { attendanceRows: true, attendanceDeclarations: true, attendanceWindows: true },
  },
} satisfies Prisma.ClassSessionInclude;

/** Poll one durable request at a time. A failed transaction leaves no partial cancellations. */
export async function processCalendarReconciliation(
  database: DatabaseClient,
): Promise<string | null> {
  const request = await database.calendarReconciliationRequest.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { status: "PENDING" },
        { status: "RUNNING", startedAt: { lt: new Date(Date.now() - 300000) } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!request) return null;
  const claimed = await database.calendarReconciliationRequest.updateMany({
    where: { id: request.id, status: request.status, updatedAt: request.updatedAt },
    data: { status: "RUNNING", startedAt: new Date(), completedAt: null, failureCode: null },
  });
  if (!claimed.count) return null;
  try {
    await database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('lazuli:teaching-schedule',158))`;
        const current = await transaction.calendarReconciliationRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: { requestedBy: { select: { name: true } } },
        });
        if (current.status === "SUCCEEDED") return;
        const counts = await reconcile(transaction, current, new Date());
        await transaction.calendarReconciliationRequest.update({
          where: { id: request.id },
          data: { ...counts, status: "SUCCEEDED", completedAt: new Date(), failureCode: null },
        });
        await transaction.activityEvent.upsert({
          where: { deduplicationKey: `calendar-reconciled:${request.id}` },
          update: {},
          create: {
            actorId: current.requestedById,
            actorName: current.requestedBy.name,
            area: "SCHOOL",
            action: "calendar.reconciled",
            title: "Atividades atualizadas pelo calendário",
            subjectType: "school",
            subjectId: request.id,
            subjectName: current.reason,
            description: `${counts.cancelledSessions} aulas, ${counts.cancelledAppointments} atendimentos e ${counts.cancelledVisits} visitas cancelados. ${counts.generatedSessions} aulas preparadas.`,
            deduplicationKey: `calendar-reconciled:${request.id}`,
          },
        });
      },
      { timeout: 60000, maxWait: 15000 },
    );
  } catch {
    await database.calendarReconciliationRequest.updateMany({
      where: { id: request.id, status: "RUNNING" },
      data: { status: "FAILED", failureCode: "RECONCILIATION_FAILED", completedAt: new Date() },
    });
    throw new Error("CALENDAR_RECONCILIATION_FAILED");
  }
  return request.id;
}

async function reconcile(
  database: Prisma.TransactionClient,
  request: CalendarReconciliationRequest,
  now: Date,
) {
  const range = { gte: request.fromDate, lte: request.throughDate };
  const [closedDays, periods, sessions, appointments, visits] = await Promise.all([
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
      include: { targetClassSession: { select: { class: { select: { semesterId: true } } } } },
    }),
    database.entryVisit.findMany({
      where: { date: range, status: "SCHEDULED", deletedAt: null },
      include: {
        class: { select: { semesterId: true } },
        assessment: { select: { visitId: true } },
      },
    }),
  ]);
  const closed = new Set(closedDays.map((row) => civil(row.date)));
  const outside = (id: string, date: Date) =>
    !periods.some(
      (period) => period.id === id && period.startDate <= date && period.endDate >= date,
    );
  const blocked = (date: Date, semesterId?: string) =>
    closed.has(civil(date)) ||
    Boolean(request.semesterId && semesterId === request.semesterId && outside(semesterId, date));
  let cancelledSessions = 0,
    cancelledAppointments = 0,
    cancelledVisits = 0;
  for (const row of appointments)
    if (blocked(row.date, row.targetClassSession?.class.semesterId))
      cancelledAppointments += await cancelCalendarAppointment(database, row.id, request, now);
  for (const row of visits)
    if (
      (blocked(row.date, row.class?.semesterId) ||
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
  for (const original of sessions) {
    if (!blocked(original.date, original.class.semesterId)) continue;
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`class-record:${original.id}`},0))`;
    const row = await database.classSession.findUniqueOrThrow({
      where: { id: original.id },
      include: sessionInclude,
    });
    if (
      !academicActivityCanBeCancelled({
        ...row,
        recorded: Boolean(
          row.classRecord ||
          row.attendanceConfirmedAt ||
          row.attendanceLastCommittedAt ||
          row.portalSubmittedAt ||
          row._count.attendanceRows ||
          row._count.attendanceDeclarations ||
          row._count.attendanceWindows,
        ),
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
  return { cancelledSessions, cancelledAppointments, cancelledVisits, generatedSessions };
}
