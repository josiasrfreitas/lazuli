import { TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { activityTransaction } from "../activity/record.js";
import { calendarChangeSchema, confirmCalendarChangeSchema } from "./change-schema.js";
import { applyCalendarChange } from "./change-apply.js";
const RECONCILIATION_RETRY_MILLISECONDS = 300_000;
import { previewCalendarChange } from "./impact.js";

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
  confirm: adminProcedure.input(confirmCalendarChangeSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "calendar.academic.confirmChange",
      options: { timeout: 30_000 },
      work: async (database) => {
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
    }),
  ),
  retry: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
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
    }),
  ),
});
