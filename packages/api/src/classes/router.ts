import {
  classArchiveInputSchema,
  classCloneForNextPeriodInputSchema,
  classCreateInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { cloneClassForNextPeriod } from "./clone.js";
import { archiveClass, createClass } from "./data.js";

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
        cloneClassForNextPeriod(buildCloneInput({ database, input })),
      ),
    ),
});

function buildCloneInput(input: {
  database: Parameters<typeof cloneClassForNextPeriod>[0]["database"];
  input: {
    id: string;
    internalCode: string;
    semesterId: string;
    year: number;
    sharedStageId?: string | undefined;
    portalClassName?: string | undefined;
  };
}): Parameters<typeof cloneClassForNextPeriod>[0] {
  return {
    database: input.database,
    id: input.input.id,
    internalCode: input.input.internalCode,
    semesterId: input.input.semesterId,
    year: input.input.year,
    ...optionalSharedStageId(input.input.sharedStageId),
    ...optionalPortalClassName(input.input.portalClassName),
  };
}

function optionalSharedStageId(sharedStageId: string | undefined): { sharedStageId?: string } {
  return typeof sharedStageId === "string" ? { sharedStageId } : {};
}

function optionalPortalClassName(portalClassName: string | undefined): {
  portalClassName?: string;
} {
  return typeof portalClassName === "string" ? { portalClassName } : {};
}
