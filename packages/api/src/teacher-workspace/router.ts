import { z, civilDateSchema } from "@lazuli/validators";
import { router, teacherProcedure } from "../trpc/init.js";
import {
  workspaceClasses,
  workspaceClass,
  workspaceStudents,
  workspaceStudent,
  pendingLessons,
} from "./read.js";
import { listClassRecords } from "../class-records/read.js";
import { listAppointments } from "../appointments/read.js";
import { individualExperimentalSessions } from "../class-records/experimental-sessions.js";
import type { Context } from "../trpc/context.js";
import { assignedVisit, assignedVisits } from "./visits.js";
import { recordVisitOutcome } from "../admissions/visits.js";
import {
  recordPlacementResult,
  uploadPlacementFile,
  downloadPlacementFile,
} from "../admissions/placement.js";
import { admissionStages } from "../admissions/catalog.js";
import {
  placementFileSchema,
  placementDownloadSchema,
  placementResultSchema,
} from "@lazuli/validators";
import { activityTransaction } from "../activity/record.js";
import { visitSubject } from "../activity/subjects.js";
import { lockTeacher } from "../teachers/availability.js";
import { badRequest } from "../trpc/errors.js";
import { teacherHomeOverview } from "./home.js";

const context = (ctx: {
  db: Context["db"];
  staffUser: NonNullable<Context["staffUser"]>;
  now?: Date | undefined;
}) => ({ database: ctx.db, staffUser: ctx.staffUser, now: ctx.now ?? new Date() });
const target = z.object({ id: z.string().uuid() }).strict();
export const teacherWorkspaceRouter = router({
  home: teacherProcedure.query(({ ctx }) => teacherHomeOverview(context(ctx))),
  visits: teacherProcedure.query(({ ctx }) => assignedVisits(context(ctx))),
  visit: teacherProcedure
    .input(target)
    .query(({ ctx, input }) => assignedVisit(context(ctx), input.id)),
  stages: teacherProcedure.query(({ ctx }) => admissionStages(ctx.db)),
  visitOutcome: teacherProcedure
    .input(
      target.extend({ status: z.enum(["ATTENDED", "ABSENT"]), notes: z.string().trim().max(2000) }),
    )
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "admissions.outcome",
        async (database) => {
          await lockTeacher(database, "");
          const visit = await assignedVisit({ ...context(ctx), database }, input.id);
          if (!visit.canRecord)
            throw badRequest("Este encontro não está disponível para registro.");
          return recordVisitOutcome({
            database,
            values: input,
            recordedById: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          });
        },
        async (_result, database) => ({ subject: await visitSubject(database, input.id) }),
      ),
    ),
  placementDownload: teacherProcedure
    .input(placementDownloadSchema)
    .mutation(async ({ ctx, input }) => {
      await assignedVisit(context(ctx), input.id);
      return downloadPlacementFile(ctx.db, input.id, input.kind);
    }),
  placementUpload: teacherProcedure.input(placementFileSchema).mutation(async ({ ctx, input }) => {
    await assignedVisit(context(ctx), input.id);
    return uploadPlacementFile(ctx, input);
  }),
  placementResult: teacherProcedure.input(placementResultSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "admissions.placementResult",
      async (database) => {
        await lockTeacher(database, "");
        await assignedVisit({ ...context(ctx), database }, input.id);
        return recordPlacementResult({
          database,
          values: input,
          recordedById: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        });
      },
      async (_result, database) => ({ subject: await visitSubject(database, input.id) }),
    ),
  ),
  classes: teacherProcedure.query(({ ctx }) => workspaceClasses(context(ctx))),
  class: teacherProcedure
    .input(target)
    .query(({ ctx, input }) => workspaceClass(context(ctx), input.id)),
  students: teacherProcedure.query(({ ctx }) => workspaceStudents(context(ctx))),
  student: teacherProcedure
    .input(target)
    .query(({ ctx, input }) => workspaceStudent(context(ctx), input.id)),
  pending: teacherProcedure.query(({ ctx }) => pendingLessons(context(ctx))),
  agenda: teacherProcedure
    .input(z.object({ date: civilDateSchema }))
    .query(async ({ ctx, input }) => {
      const current = context(ctx);
      const [lessons, appointments, experiments] = await Promise.all([
        listClassRecords(current, { from: input.date, to: input.date }),
        listAppointments(current, { from: input.date, through: input.date }),
        individualExperimentalSessions(current, { from: input.date, to: input.date }),
      ]);
      return { lessons, appointments, experiments };
    }),
});
