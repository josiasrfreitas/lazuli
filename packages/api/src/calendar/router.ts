import { activityTransaction } from "../activity/record.js";
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
      const result = await activityTransaction(
        ctx,
        "calendar.createSemester",
        async (database) => {
          const semester = await createSemester({
            database,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
          });
          const generation = await requestSessionGeneration(
            database,
            { semesterId: semester.id },
            ctx.staffUser.id,
            ctx.now ?? new Date(),
          );
          return { semester, generationRequestId: generation.id };
        },
        (result) => ({
          subject: { type: "school", name: result.semester.name },
          deduplicationKey: `calendar.createSemester:${result.semester.id}`,
        }),
      );

      const enqueueResult = await dispatchSessionGeneration({
        database: ctx.db,
        requestId: result.generationRequestId,
        ...(ctx.sessionGenerationQueue ? { queue: ctx.sessionGenerationQueue } : {}),
      });

      return { semester: result.semester, sessionsGenerateJob: enqueueResult };
    }),
  importBrazilFederalHolidays: adminProcedure
    .input(importBrazilFederalHolidaysInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "calendar.importBrazilFederalHolidays",
        (database) =>
          importBrazilFederalHolidays({
            database,
            year: input.year,
            createdById: ctx.staffUser.id,
          }),
        () => ({ subject: { type: "school", name: `Calendário ${input.year}` } }),
      ),
    ),
  addClosedDay: adminProcedure.input(addClosedDayInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "calendar.addClosedDay",
      (database) =>
        addClosedDay({
          database,
          date: input.date,
          reason: input.reason,
          createdById: ctx.staffUser.id,
        }),
      () => ({
        subject: { type: "school", name: "Calendário escolar" },
        description: input.reason,
      }),
    ),
  ),
  removeClosedDay: adminProcedure.input(removeClosedDayInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "calendar.removeClosedDay",
      (database) => removeClosedDay({ database, date: input.date }),
      () => ({
        subject: { type: "school", name: "Calendário escolar" },
        description: `Dia removido: ${input.date.split("-").reverse().join("/")}.`,
      }),
    ),
  ),
});
