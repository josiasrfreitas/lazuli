import {
  z,
  civilDateSchema,
  occurrenceCreateSchema,
  occurrenceLinkSchema,
  occurrenceUpdateSchema,
  interventionCreateSchema,
  interventionFollowUpSchema,
  interventionLinkSchema,
  pedagogicalListSchema,
} from "@lazuli/validators";
import { staffProcedure, adminProcedure, router } from "../trpc/init.js";
import type { Context, StaffUser } from "../trpc/context.js";
import type { FollowUpContext } from "./data.js";
import {
  occurrenceSessions,
  occurrenceRoster,
  interventionStaff,
  interventionFormOptions,
} from "./sessions.js";
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
  updateOccurrence,
  createIntervention,
  addInterventionFollowUp,
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
  sessions: staffProcedure
    .input(
      z
        .object({
          studentId: z.string().uuid().optional(),
          range: z
            .object({ from: civilDateSchema, to: civilDateSchema })
            .strict()
            .refine(
              ({ from, to }) => from <= to && Date.parse(to) - Date.parse(from) <= 6 * 86_400_000,
              "Escolha um período de até sete dias.",
            )
            .optional(),
        })
        .strict()
        .optional(),
    )
    .query(({ ctx, input }) => occurrenceSessions(context(ctx), input?.studentId, input?.range)),
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
  update: staffProcedure
    .input(occurrenceUpdateSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => updateOccurrence({ ...context(ctx), database }, input)),
    ),
});
export const interventionsRouter = router({
  list: staffProcedure
    .input(pedagogicalListSchema)
    .query(({ ctx, input }) => listInterventions(context(ctx), input)),
  byId: staffProcedure
    .input(byId)
    .query(({ ctx, input }) => interventionDetail(context(ctx), input.id)),
  staff: adminProcedure.query(({ ctx }) => interventionStaff(context(ctx))),
  formOptions: adminProcedure
    .input(z.object({ studentId: z.string().uuid() }).strict())
    .query(({ ctx, input }) => interventionFormOptions(context(ctx), input.studentId)),
  create: adminProcedure
    .input(interventionCreateSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createIntervention({ ...context(ctx), database }, input)),
    ),
  followUp: staffProcedure
    .input(interventionFollowUpSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        addInterventionFollowUp({ ...context(ctx), database }, input),
      ),
    ),
  link: adminProcedure
    .input(interventionLinkSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        addInterventionOccurrence({ ...context(ctx), database }, input),
      ),
    ),
});
