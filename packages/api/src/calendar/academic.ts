import { z } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc/init.js";
import { activityTransaction } from "../activity/record.js";

const eventInput = z
  .object({
    id: z.string().uuid().optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((value) => Boolean(value.id) === Boolean(value.expectedUpdatedAt), {
    message: "Reabra o evento para carregar a versão atual.",
    path: ["expectedUpdatedAt"],
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "O fim deve ser posterior ao início.",
    path: ["endsAt"],
  });

export const academicCalendarRouter = router({
  year: adminProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const from = new Date(`${input.year}-01-01T00:00:00-03:00`);
      const through = new Date(`${input.year + 1}-01-01T00:00:00-03:00`);
      const [periods, closedDays, events] = await Promise.all([
        ctx.db.period.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, startDate: true, endDate: true },
          orderBy: { startDate: "asc" },
        }),
        ctx.db.schoolClosedDay.findMany({
          where: {
            deletedAt: null,
            date: {
              gte: new Date(`${input.year}-01-01T00:00:00Z`),
              lt: new Date(`${input.year + 1}-01-01T00:00:00Z`),
            },
          },
          select: { id: true, date: true, reason: true },
          orderBy: { date: "asc" },
        }),
        ctx.db.academicEvent.findMany({
          where: { deletedAt: null, startsAt: { lt: through }, endsAt: { gt: from } },
          select: {
            id: true,
            title: true,
            description: true,
            startsAt: true,
            endsAt: true,
            updatedAt: true,
          },
          orderBy: { startsAt: "asc" },
        }),
      ]);
      return { periods, closedDays, events };
    }),
  saveEvent: adminProcedure.input(eventInput).mutation(async ({ ctx, input }) => {
    const data = {
      title: input.title,
      description: input.description || null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    };
    return activityTransaction(ctx, {
      action: "calendar.academic.saveEvent",
      work: async (database) => {
        if (!input.id) return database.academicEvent.create({ data, select: { id: true } });
        const result = await database.academicEvent.updateMany({
          where: { id: input.id, deletedAt: null, updatedAt: new Date(input.expectedUpdatedAt!) },
          data,
        });
        if (!result.count)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este evento foi alterado ou removido. Reabra-o para carregar a versão atual.",
          });
        return { id: input.id };
      },
      describe: (result) => ({
        subject: { type: "school", id: result.id, name: input.title },
        description: input.id
          ? "Evento do calendário atualizado."
          : "Evento adicionado ao calendário.",
      }),
    });
  }),
  removeEvent: adminProcedure
    .input(
      z
        .object({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }) })
        .strict(),
    )
    .mutation(({ ctx, input }) =>
      activityTransaction(ctx, {
        action: "calendar.academic.removeEvent",
        work: async (database) => {
          const event = await database.academicEvent.findFirst({
            where: { id: input.id, deletedAt: null },
            select: { title: true },
          });
          const result = await database.academicEvent.updateMany({
            where: { id: input.id, deletedAt: null, updatedAt: new Date(input.expectedUpdatedAt) },
            data: { deletedAt: ctx.now ?? new Date() },
          });
          if (!result.count || !event)
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Este evento foi alterado ou removido. Reabra-o para carregar a versão atual.",
            });
          return { id: input.id, title: event.title };
        },
        describe: (result) => ({ subject: { type: "school", id: result.id, name: result.title } }),
      }),
    ),
});
