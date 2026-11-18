import type { CalendarExecutionSnapshot } from "@lazuli/job-contracts";
import { TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { activityTransaction } from "../activity/record.js";
import { calendarChangeSchema, confirmCalendarChangeSchema } from "./change-schema.js";
import { lockIntakeCalendar } from "../semester-organization/future-student-intake.js";
import { applyCalendarChange } from "./change-apply.js";
const MAX_STATUS_REQUESTS = 100;
const MIN_CALENDAR_YEAR = 2000;
const MAX_CALENDAR_YEAR = 2100;
const RECONCILIATION_RETRY_MILLISECONDS = 300_000;
import { dispatchCalendarReconciliation } from "./dispatch.js";
import { previewCalendarChange } from "./impact.js";
import { requireCalendarConfirmation } from "./confirmation.js";

export const calendarChangesRouter = router({
  preview: adminProcedure
    .input(calendarChangeSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) =>
          previewCalendarChange(database, { change: input, now: ctx.now ?? new Date() }),
        { isolationLevel: "RepeatableRead", timeout: 15_000 },
      ),
    ),
  confirm: adminProcedure.input(confirmCalendarChangeSchema).mutation(async ({ ctx, input }) => {
    const request = await activityTransaction(ctx, {
      action: "calendar.academic.confirmChange",
      options: { timeout: 30_000 },
      work: async (database) => {
        if (input.change.action === "period") await lockIntakeCalendar(database);
        if (input.change.action === "period" && input.change.id)
          await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${input.change.id}`},0))`;
        await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('lazuli:teaching-schedule',158))`;
        const existing = await database.calendarReconciliationRequest.findUnique({
          where: { id: input.commandId },
        });
        if (existing) {
          if (
            existing.requestedById !== ctx.staffUser.id ||
            existing.confirmationFingerprint !== input.fingerprint
          )
            throw new TRPCError({
              code: "CONFLICT",
              message: "Esta solicitação pertence a outra operação. Reabra a prévia.",
            });
          return existing;
        }
        const now = ctx.now ?? new Date();
        const preview = await previewCalendarChange(database, { change: input.change, now });
        if (preview.fingerprint !== input.fingerprint)
          throw new TRPCError({
            code: "CONFLICT",
            message: "A agenda mudou desde a prévia. Volte e confira os impactos novamente.",
          });
        requireCalendarConfirmation(preview.confirmationPhrase, input.confirmationText);
        const data = await applyCalendarChange(database, {
          change: input.change,
          actorId: ctx.staffUser.id,
          now,
        });
        return database.calendarReconciliationRequest.create({
          data: {
            id: input.commandId,
            ...data,
            requestedById: ctx.staffUser.id,
            confirmationFingerprint: input.fingerprint,
          },
        });
      },
      describe: (result) => ({
        subject: { type: "school", id: result.id, name: result.reason },
        description: "Alteração confirmada; atualização das atividades solicitada.",
        deduplicationKey: `calendar-change:${result.id}`,
      }),
    });
    const dispatched =
      request.status === "SUCCEEDED" || (await dispatchCalendarReconciliation(ctx, request.id));
    return { ...request, dispatched };
  }),
  executionStatuses: adminProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(MAX_STATUS_REQUESTS) }).strict())
    .query(async ({ ctx, input }): Promise<CalendarExecutionSnapshot> => {
      const requests = await ctx.db.calendarReconciliationRequest.findMany({
        where: { id: { in: input.ids }, deletedAt: null },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      const first = requests[0];
      if (!first || !ctx.calendarReconciliationQueue?.statuses)
        return { available: false, statuses: {} };
      return ctx.calendarReconciliationQueue.statuses(
        requests.map((row) => row.id),
        first.createdAt,
      );
    }),
  runPending: adminProcedure
    .input(
      z.object({ year: z.number().int().min(MIN_CALENDAR_YEAR).max(MAX_CALENDAR_YEAR) }).strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const requests = await ctx.db.calendarReconciliationRequest.findMany({
        where: {
          deletedAt: null,
          status: "PENDING",
          fromDate: { lt: new Date(`${input.year + 1}-01-01T00:00:00Z`) },
          throughDate: { gte: new Date(`${input.year}-01-01T00:00:00Z`) },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      const executions: { id: string; dispatched: boolean }[] = [];
      let dispatched = 0;
      for (const request of requests) {
        const sent = await dispatchCalendarReconciliation(ctx, request.id);
        executions.push({ id: request.id, dispatched: sent });
        if (sent) dispatched += 1;
      }
      return { pending: requests.length, dispatched, executions };
    }),
  retry: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const request = await activityTransaction(ctx, {
        action: "calendar.academic.retry",
        work: async (database) => {
          const result = await database.calendarReconciliationRequest.updateMany({
            where: {
              id: input.id,
              deletedAt: null,
              OR: [
                { status: "FAILED" },
                {
                  status: "RUNNING",
                  startedAt: { lt: new Date(Date.now() - RECONCILIATION_RETRY_MILLISECONDS) },
                },
              ],
            },
            data: { status: "PENDING", startedAt: null, completedAt: null, failureCode: null },
          });
          if (!result.count)
            throw new TRPCError({
              code: "CONFLICT",
              message: "A atualização já está em processamento ou foi concluída.",
            });
          return input;
        },
        describe: (result) => ({
          subject: { type: "school", id: result.id, name: "Calendário acadêmico" },
        }),
      });
      return { ...request, dispatched: await dispatchCalendarReconciliation(ctx, request.id) };
    }),
});
