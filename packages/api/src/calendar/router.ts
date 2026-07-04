import {
  addClosedDayInputSchema,
  createSemesterInputSchema,
  importBrazilFederalHolidaysInputSchema,
  removeClosedDayInputSchema,
} from "@lazuli/validators";
import { createLocalSessionsGenerateQueue, enqueueSessionsGenerate } from "@lazuli/job-contracts";

import { adminProcedure, router } from "../trpc/init.js";
import {
  addClosedDay,
  createSemester,
  importBrazilFederalHolidays,
  removeClosedDay,
} from "./data.js";

export const calendarRouter = router({
  createSemester: adminProcedure
    .input(createSemesterInputSchema)
    .mutation(async ({ ctx, input }) => {
      const semester = await ctx.db.$transaction((database) =>
        createSemester({
          database,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      );

      const enqueueResult = await enqueueSessionsGenerate({
        queue: ctx.sessionGenerationQueue ?? createLocalSessionsGenerateQueue(),
        payload: { semesterId: semester.id },
      });

      return { semester, sessionsGenerateJob: enqueueResult };
    }),
  importBrazilFederalHolidays: adminProcedure
    .input(importBrazilFederalHolidaysInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        importBrazilFederalHolidays({
          database,
          year: input.year,
          createdById: ctx.staffUser.id,
        }),
      ),
    ),
  addClosedDay: adminProcedure.input(addClosedDayInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      addClosedDay({
        database,
        date: input.date,
        reason: input.reason,
        createdById: ctx.staffUser.id,
      }),
    ),
  ),
  removeClosedDay: adminProcedure
    .input(removeClosedDayInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => removeClosedDay({ database, date: input.date })),
    ),
});
