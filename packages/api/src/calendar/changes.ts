import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";
import { z } from "@lazuli/validators";
import { adminProcedure, router } from "../trpc/init.js";
import { activityTransaction } from "../activity/record.js";
import {
  calendarChangeSchema,
  confirmCalendarChangeSchema,
  type CalendarChange,
} from "./change-schema.js";
import { calendarChangeState, civil, datesBetween, day } from "./change-state.js";
import { previewCalendarChange } from "./impact.js";

async function applyCalendarChange(
  database: Prisma.TransactionClient,
  change: CalendarChange,
  actorId: string,
  now: Date,
) {
  const state = await calendarChangeState(database, change);
  let semesterId: string | null = null;
  if (change.action === "period") {
    const data = { name: change.name, startDate: day(change.from), endDate: day(change.through) };
    const period = change.id
      ? await database.period.update({ where: { id: change.id }, data })
      : await database.period.create({ data });
    semesterId = period.id;
  } else if (change.action === "interruption") {
    const data = {
      title: change.title,
      description: change.description,
      kind: change.kind,
      fromDate: day(change.from),
      throughDate: day(change.through),
    };
    if (change.id) await database.academicInterruption.update({ where: { id: change.id }, data });
    else await database.academicInterruption.create({ data: { ...data, createdById: actorId } });
  } else if (change.action === "removeInterruption") {
    await database.academicInterruption.update({
      where: { id: change.id },
      data: { deletedAt: now, sourceKey: null },
    });
  } else {
    for (const item of change.dates)
      await database.academicInterruption.upsert({
        where: { sourceKey: item.sourceKey },
        update: {},
        create: {
          title: item.title,
          kind: "HOLIDAY",
          fromDate: day(item.date),
          throughDate: day(item.date),
          sourceKey: item.sourceKey,
          createdById: actorId,
        },
      });
  }
  if (change.action !== "period") {
    // A union projection keeps overlapping interruptions and pre-existing manual dates intact.
    const interruptions = await database.academicInterruption.findMany({
      where: {
        deletedAt: null,
        fromDate: { lte: day(state.through) },
        throughDate: { gte: day(state.from) },
      },
    });
    const unmanaged = new Set(
      state.closedDays.filter((row) => !row.calendarManaged).map((row) => civil(row.date)),
    );
    for (const date of datesBetween(state.from, state.through)) {
      if (unmanaged.has(date)) continue;
      const applicable = interruptions.filter(
        (row) => civil(row.fromDate) <= date && civil(row.throughDate) >= date,
      );
      if (applicable.length)
        await database.schoolClosedDay.upsert({
          where: { date: day(date) },
          create: {
            date: day(date),
            reason: applicable.map((row) => row.title).join(" · "),
            calendarManaged: true,
            createdById: actorId,
          },
          update: {
            deletedAt: null,
            reason: applicable.map((row) => row.title).join(" · "),
            calendarManaged: true,
          },
        });
      else
        await database.schoolClosedDay.updateMany({
          where: { date: day(date), calendarManaged: true, deletedAt: null },
          data: { deletedAt: now },
        });
    }
  }
  const reason =
    change.action === "period"
      ? `Limites do semestre · ${change.name}`
      : change.action === "interruption"
        ? change.title
        : change.action === "removeInterruption"
          ? `Remoção · ${state.interruption!.title}`
          : "Feriados do calendário acadêmico";
  return { semesterId, reason, fromDate: day(state.from), throughDate: day(state.through) };
}

export const calendarChangesRouter = router({
  preview: adminProcedure
    .input(calendarChangeSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) => previewCalendarChange(database, input, ctx.now ?? new Date()),
        { isolationLevel: "RepeatableRead", timeout: 15000 },
      ),
    ),
  confirm: adminProcedure.input(confirmCalendarChangeSchema).mutation(({ ctx, input }) =>
    activityTransaction(ctx, {
      action: "calendar.academic.confirmChange",
      options: { timeout: 30000 },
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
        const preview = await previewCalendarChange(database, input.change, now);
        if (preview.fingerprint !== input.fingerprint)
          throw new TRPCError({
            code: "CONFLICT",
            message: "A agenda mudou desde a prévia. Volte e confira os impactos novamente.",
          });
        const data = await applyCalendarChange(database, input.change, ctx.staffUser.id, now);
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
              { status: "RUNNING", startedAt: { lt: new Date(Date.now() - 300000) } },
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
