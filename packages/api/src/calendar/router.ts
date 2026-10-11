import { recordActivity } from "../activity/record.js";
import {
  addClosedDayInputSchema,
  createSemesterInputSchema,
  importBrazilFederalHolidaysInputSchema,
  removeClosedDayInputSchema,
} from "@lazuli/validators";
import {
  requestSessionGeneration,
  dispatchSessionGeneration,
} from "../session-generation/requests.js";

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
      const result = await ctx.db.$transaction(async (database) => {
        const semester = await createSemester({
          database,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        const request = await requestSessionGeneration(database, {
          scope: { semesterId: semester.id },
          requestedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
        await recordActivity(database, ctx, "calendar.createSemester", {
          subject: { type: "school", name: semester.name },
          deduplicationKey: `calendar.createSemester:${semester.id}`,
        });
        return { semester, requestId: request.id };
      });
      const sessionsGenerateJob = await dispatchSessionGeneration({
        database: ctx.db,
        requestId: result.requestId,
        queue: ctx.sessionGenerationQueue,
      });
      return { semester: result.semester, sessionsGenerateJob };
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
