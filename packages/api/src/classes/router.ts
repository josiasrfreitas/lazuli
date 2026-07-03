import {
  classArchiveInputSchema,
  classCloneForNextPeriodInputSchema,
  classCreateInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { archiveClass, cloneClassForNextPeriod, createClass } from "./data.js";

export const classesRouter = router({
  create: adminProcedure
    .input(classCreateInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createClass({ database, values: input })),
    ),
  archive: adminProcedure
    .input(classArchiveInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => archiveClass({ database, id: input.id })),
    ),
  cloneForNextPeriod: adminProcedure
    .input(classCloneForNextPeriodInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        cloneClassForNextPeriod({
          database,
          id: input.id,
          internalCode: input.internalCode,
          semesterId: input.semesterId,
          year: input.year,
          ...(input.sharedStageId !== undefined ? { sharedStageId: input.sharedStageId } : {}),
          ...(input.portalClassName !== undefined ? { portalClassName: input.portalClassName } : {}),
        }),
      ),
    ),
});
