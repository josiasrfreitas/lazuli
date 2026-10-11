import {
  z,
  occurrenceCreateSchema,
  occurrenceLinkSchema,
  occurrenceNoteSchema,
  interventionCreateSchema,
  interventionUpdateSchema,
  interventionLinkSchema,
  pedagogicalListSchema,
} from "@lazuli/validators";
import { staffProcedure, adminProcedure, router } from "../trpc/init.js";
import type { Context, StaffUser } from "../trpc/context.js";
import type { FollowUpContext } from "./data.js";
import { occurrenceSessions, occurrenceRoster, interventionTeachers } from "./sessions.js";
import {
  listOccurrences,
  listInterventions,
  occurrenceDetail,
  interventionDetail,
  studentOccurrences,
} from "./read.js";
import {
  createOccurrence,
  linkOccurrences,
  addOccurrenceNote,
  createIntervention,
  updateIntervention,
  addInterventionOccurrence,
} from "./write.js";
const byId = z.object({ id: z.string().uuid() }).strict();
const context = (ctx: Context & { staffUser: StaffUser }): FollowUpContext => ({
  database: ctx.db,
  staffUser: ctx.staffUser,
  now: ctx.now ?? new Date(),
});
export const occurrencesRouter = router({
  list: staffProcedure
    .input(pedagogicalListSchema)
    .query(({ ctx, input }) => listOccurrences(context(ctx), input)),
  byId: staffProcedure
    .input(byId)
    .query(({ ctx, input }) => occurrenceDetail(context(ctx), input.id)),
  forStudent: staffProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) => studentOccurrences(context(ctx), input.studentId)),
  sessions: staffProcedure.query(({ ctx }) => occurrenceSessions(context(ctx))),
  roster: staffProcedure
    .input(byId)
    .query(({ ctx, input }) => occurrenceRoster(context(ctx), input.id)),
  create: staffProcedure
    .input(occurrenceCreateSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createOccurrence({ ...context(ctx), database }, input)),
    ),
  link: staffProcedure
    .input(occurrenceLinkSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => linkOccurrences({ ...context(ctx), database }, input)),
    ),
  note: staffProcedure
    .input(occurrenceNoteSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => addOccurrenceNote({ ...context(ctx), database }, input)),
    ),
});
export const interventionsRouter = router({
  list: staffProcedure
    .input(pedagogicalListSchema)
    .query(({ ctx, input }) => listInterventions(context(ctx), input)),
  byId: staffProcedure
    .input(byId)
    .query(({ ctx, input }) => interventionDetail(context(ctx), input.id)),
  teachers: adminProcedure.query(({ ctx }) => interventionTeachers(context(ctx))),
  create: adminProcedure
    .input(interventionCreateSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createIntervention({ ...context(ctx), database }, input)),
    ),
  update: staffProcedure
    .input(interventionUpdateSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => updateIntervention({ ...context(ctx), database }, input)),
    ),
  link: adminProcedure
    .input(interventionLinkSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        addInterventionOccurrence({ ...context(ctx), database }, input),
      ),
    ),
});
