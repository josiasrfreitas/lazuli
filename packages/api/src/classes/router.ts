import { classSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
import {
  classArchiveInputSchema,
  classCloneForNextPeriodInputSchema,
  classCreateInputSchema,
  classGenerateSessionsInputSchema,
  classIdInputSchema,
  classListInputSchema,
  classRelatedListInputSchema,
  classRosterInputSchema,
} from "@lazuli/validators";
import { createLocalSessionsGenerateQueue, enqueueSessionsGenerate } from "@lazuli/job-contracts";

import { adminProcedure, router } from "../trpc/init.js";
import { cloneClassForNextPeriod } from "./clone.js";
import { archiveClass, assertGenerationScopeExists, createClass } from "./data.js";
import {
  classFormOptions,
  listClassActions,
  listClassRoster,
  listClasses,
  readClass,
} from "./read.js";

export const classesRouter = router({
  list: adminProcedure
    .input(classListInputSchema)
    .query(({ ctx, input }) =>
      listClasses({ database: ctx.db, values: input, now: ctx.now ?? new Date() }),
    ),
  byId: adminProcedure
    .input(classIdInputSchema)
    .query(({ ctx, input }) =>
      readClass({ database: ctx.db, id: input.id, now: ctx.now ?? new Date() }),
    ),
  roster: adminProcedure.input(classRosterInputSchema).query(({ ctx, input }) =>
    listClassRoster({
      database: ctx.db,
      id: input.id,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search,
      situations: input.situations,
      now: ctx.now ?? new Date(),
    }),
  ),
  actions: adminProcedure.input(classRelatedListInputSchema).query(({ ctx, input }) =>
    listClassActions({
      database: ctx.db,
      id: input.id,
      page: input.page,
      pageSize: input.pageSize,
    }),
  ),
  formOptions: adminProcedure.query(({ ctx }) => classFormOptions(ctx.db)),
  create: adminProcedure.input(classCreateInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "classes.create",
      (database) => createClass({ database, values: input, recordedById: ctx.staffUser.id }),
      async (result, database) => ({
        subject: await classSubject(database, result.id),
        deduplicationKey: `classes.create:${result.id}`,
      }),
    ),
  ),
  archive: adminProcedure.input(classArchiveInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "classes.archive",
      (database) => archiveClass({ database, id: input.id }),
      async (_result, database) => ({ subject: await classSubject(database, input.id) }),
    ),
  ),
  cloneForNextPeriod: adminProcedure
    .input(classCloneForNextPeriodInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "classes.cloneForNextPeriod",
        (database) =>
          cloneClassForNextPeriod({
            ...buildCloneInput({ database, input }),
            recordedById: ctx.staffUser.id,
          }),
        async (result, database) => ({
          subject: await classSubject(database, result.successor.id),
          description: `Continuação de ${result.source.portalClassName}.`,
          deduplicationKey: `classes.clone:${result.successor.id}`,
        }),
      ),
    ),
  generateSessions: adminProcedure
    .input(classGenerateSessionsInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction((database) =>
        assertGenerationScopeExists({
          database,
          ...optionalClassId(input.classId),
          ...optionalSemesterId(input.semesterId),
        }),
      );

      return enqueueSessionsGenerate({
        queue: ctx.sessionGenerationQueue ?? createLocalSessionsGenerateQueue(),
        payload: {
          ...optionalClassId(input.classId),
          ...optionalSemesterId(input.semesterId),
        },
      });
    }),
});

function buildCloneInput(input: {
  database: Parameters<typeof cloneClassForNextPeriod>[0]["database"];
  input: {
    id: string;
    semesterId: string;
    sharedStageId?: string | undefined;
    portalClassName?: string | undefined;
  };
}): Parameters<typeof cloneClassForNextPeriod>[0] {
  return {
    database: input.database,
    id: input.input.id,
    semesterId: input.input.semesterId,
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

function optionalClassId(classId: string | undefined): { classId?: string } {
  return typeof classId === "string" ? { classId } : {};
}

function optionalSemesterId(semesterId: string | undefined): { semesterId?: string } {
  return typeof semesterId === "string" ? { semesterId } : {};
}
