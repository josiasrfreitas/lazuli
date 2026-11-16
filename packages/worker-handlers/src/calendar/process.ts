import type { DatabaseClient } from "@lazuli/db";
import { reconcileCalendar } from "./reconcile.js";

const RECONCILIATION_RETRY_MILLISECONDS = 300_000;
/** Poll one durable request at a time. A failed transaction leaves no partial cancellations. */
export async function processCalendarReconciliation(
  database: DatabaseClient,
  requestId?: string,
): Promise<string | null> {
  const request = await database.calendarReconciliationRequest.findFirst({
    where: {
      deletedAt: null,
      ...(requestId ? { id: requestId } : {}),
      OR: [
        { status: "PENDING" },
        {
          status: "RUNNING",
          startedAt: { lt: new Date(Date.now() - RECONCILIATION_RETRY_MILLISECONDS) },
        },
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
        const counts = await reconcileCalendar(transaction, { request: current, now: new Date() });
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
      { timeout: 60_000, maxWait: 15_000 },
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

/** Snapshot the backlog so one daily run handles more than the oldest request. */
export async function recoverCalendarReconciliations(database: DatabaseClient): Promise<void> {
  const requests = await database.calendarReconciliationRequest.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: "PENDING" },
        {
          status: "RUNNING",
          startedAt: { lt: new Date(Date.now() - RECONCILIATION_RETRY_MILLISECONDS) },
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  await recoverCalendarRequests({
    requests,
    process: (requestId) => processCalendarReconciliation(database, requestId),
  });
}

/** Continue the backlog after one failed request, then expose a failed recovery run to Hatchet. */
export async function recoverCalendarRequests(input: {
  requests: { id: string }[];
  process: (requestId: string) => Promise<string | null>;
}): Promise<void> {
  let failed = 0;
  for (const request of input.requests) {
    try {
      await input.process(request.id);
    } catch {
      failed += 1;
    }
  }
  if (failed) throw new Error("CALENDAR_RECOVERY_FAILED");
}
