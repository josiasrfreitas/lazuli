import {
  addClosedDayInputSchema,
  importBrazilFederalHolidaysInputSchema,
  removeClosedDayInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { addClosedDay, importBrazilFederalHolidays, removeClosedDay } from "./data.js";

export const calendarRouter = router({
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
