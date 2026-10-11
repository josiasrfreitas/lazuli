import { activityTransaction } from "../activity/record.js";
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
      const semester = await activityTransaction(
        ctx,
        "calendar.createSemester",
        (database) =>
          createSemester({
            database,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
          }),
        (result) => ({
          subject: { type: "school", name: result.name },
          deduplicationKey: `calendar.createSemester:${result.id}`,
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
