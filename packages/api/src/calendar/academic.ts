import { z } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../trpc/init.js";

const eventInput = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .strict()
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
          select: { id: true, title: true, description: true, startsAt: true, endsAt: true },
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
    if (!input.id) return ctx.db.academicEvent.create({ data, select: { id: true } });
    const result = await ctx.db.academicEvent.updateMany({
      where: { id: input.id, deletedAt: null },
      data,
    });
    if (!result.count)
      throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    return { id: input.id };
  }),
  removeEvent: adminProcedure
    .input(z.object({ id: z.string().uuid() }).strict())
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.academicEvent.updateMany({
        where: { id: input.id, deletedAt: null },
        data: { deletedAt: ctx.now ?? new Date() },
      });
      if (!result.count)
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      return { id: input.id };
    }),
});
