import {
  z,
  stagePlanTargetSchema,
  stagePlanWindowSchema,
  stagePlanItemSchema,
  stagePlanRemoveSchema,
} from "@lazuli/validators";
import { staffProcedure, router } from "../trpc/init.js";
import type { Context, StaffUser } from "../trpc/context.js";
import type { PlanningContext } from "./data.js";
import { planningContexts, readPlanning, planningHistory } from "./read.js";
import {
  savePlanWindow,
  savePlanItem,
  removePlanItem,
  prepareProgramPlan,
  saveProgramStart,
} from "./write.js";
const context = (ctx: {
  db: Context["db"];
  staffUser: StaffUser;
  now?: Date | undefined;
}): PlanningContext => ({
  database: ctx.db,
  staffUser: ctx.staffUser,
  now: ctx.now ?? new Date(),
});
export const planningRouter = router({
  prepare: staffProcedure.input(stagePlanTargetSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => prepareProgramPlan({ ...context(ctx), database }, input), {
      timeout: 30000,
    }),
  ),
  contexts: staffProcedure.query(({ ctx }) => planningContexts(context(ctx))),
  detail: staffProcedure
    .input(stagePlanTargetSchema)
    .query(({ ctx, input }) => readPlanning(context(ctx), input)),
  history: staffProcedure
    .input(
      stagePlanTargetSchema.extend({
        cursor: z.number().int().positive().optional(),
        direction: z.enum(["forward", "backward"]).optional(),
      }),
    )
    .query(({ ctx, input }) => planningHistory(context(ctx), input)),
  saveStart: staffProcedure.input(stagePlanWindowSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => saveProgramStart({ ...context(ctx), database }, input), {
      timeout: 30000,
    }),
  ),
  saveWindow: staffProcedure
    .input(stagePlanWindowSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => savePlanWindow({ ...context(ctx), database }, input)),
    ),
  saveItem: staffProcedure
    .input(stagePlanItemSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => savePlanItem({ ...context(ctx), database }, input)),
    ),
  removeItem: staffProcedure
    .input(stagePlanRemoveSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => removePlanItem({ ...context(ctx), database }, input)),
    ),
});
