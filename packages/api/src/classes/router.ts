import { recordActivity, activityTransaction } from "../activity/record.js";
import { classSubject } from "../activity/subjects.js";
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
import {
  requestSessionGeneration,
  dispatchSessionGeneration,
} from "../session-generation/requests.js";
import { readClassGeneration, readClassSessions } from "../session-generation/read.js";

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
  generation: adminProcedure
    .input(classIdInputSchema)
    .query(({ ctx, input }) =>
      readClassGeneration(ctx.db, { id: input.id, now: ctx.now ?? new Date() }),
    ),
  sessions: adminProcedure.input(classRelatedListInputSchema).query(({ ctx, input }) =>
    ctx.db.$transaction((database) => readClassSessions(database, input), {
      isolationLevel: "RepeatableRead",
    }),
  ),
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
  create: adminProcedure.input(classCreateInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.db.$transaction(async (database) => {
      const created = await createClass({
        database,
        values: input,
        recordedById: ctx.staffUser.id,
      });
      const request = await requestSessionGeneration(database, {
        scope: { classId: created.id },
        requestedById: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      });
      await recordActivity(database, ctx, "classes.create", {
        subject: await classSubject(database, created.id),
        deduplicationKey: `classes.create:${created.id}`,
      });
      return { ...created, generationRequestId: request.id };
    });
    await dispatchSessionGeneration({
      database: ctx.db,
      requestId: result.generationRequestId,
      queue: ctx.sessionGenerationQueue,
    });
    return result;
  }),
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
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async (database) => {
        const cloned = await cloneClassForNextPeriod({
          ...buildCloneInput({ database, input }),
          recordedById: ctx.staffUser.id,
        });
        const request = await requestSessionGeneration(database, {
          scope: { classId: cloned.successor.id },
          requestedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
        await recordActivity(database, ctx, "classes.cloneForNextPeriod", {
          subject: await classSubject(database, cloned.successor.id),
          description: `Continuação de ${cloned.source.portalClassName}.`,
          deduplicationKey: `classes.clone:${cloned.successor.id}`,
        });
        return { ...cloned, generationRequestId: request.id };
      });
      await dispatchSessionGeneration({
        database: ctx.db,
        requestId: result.generationRequestId,
        queue: ctx.sessionGenerationQueue,
      });
      return result;
    }),
  generateSessions: adminProcedure
    .input(classGenerateSessionsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.$transaction(async (database) => {
        await assertGenerationScopeExists({
          database,
          ...optionalClassId(input.classId),
          ...optionalSemesterId(input.semesterId),
        });
        return requestSessionGeneration(database, {
          scope: { ...optionalClassId(input.classId), ...optionalSemesterId(input.semesterId) },
          requestedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
      });
      return dispatchSessionGeneration({
        database: ctx.db,
        requestId: request.id,
        queue: ctx.sessionGenerationQueue,
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
