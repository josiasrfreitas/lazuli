import { z, classRecordListSchema, classRecordSaveSchema } from "@lazuli/validators";
import { router, staffProcedure } from "../trpc/init.js";
import { classRecordHistory, listClassRecords, readClassRecord } from "./read.js";
import { saveClassRecord } from "./write.js";
import { classStageProgress } from "./progress.js";
import { individualExperimentalSessions } from "./experimental-sessions.js";
const target = z.object({ sessionId: z.string().uuid() }).strict();
export const classRecordsRouter = router({
  experimentalSessions: staffProcedure
    .input(classRecordListSchema)
    .query(({ ctx, input }) =>
      individualExperimentalSessions(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  progress: staffProcedure
    .input(z.object({ classId: z.string().uuid() }).strict())
    .query(({ ctx, input }) =>
      classStageProgress(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.classId,
      ),
    ),
  list: staffProcedure
    .input(classRecordListSchema)
    .query(({ ctx, input }) =>
      listClassRecords(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  detail: staffProcedure
    .input(target)
    .query(({ ctx, input }) =>
      readClassRecord(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input.sessionId,
      ),
    ),
  history: staffProcedure
    .input(
      target.extend({
        cursor: z.number().int().positive().optional(),
        direction: z.enum(["forward", "backward"]).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      classRecordHistory(
        { database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() },
        input,
      ),
    ),
  save: staffProcedure
    .input(classRecordSaveSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        saveClassRecord({ database, staffUser: ctx.staffUser, now: ctx.now ?? new Date() }, input),
      ),
    ),
});
