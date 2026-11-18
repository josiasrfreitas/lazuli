import {
  z,
  stagePlanTargetSchema,
  stagePlanWindowSchema,
  stagePlanItemSchema,
  stagePlanRemoveSchema,
} from "@lazuli/validators";
import { adminProcedure, staffProcedure, router } from "../trpc/init.js";
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
import {
  extraClassesSchema,
  endClassesSchema,
  confirmEndClassesSchema,
} from "./adjustment-schema.js";
import { previewExtraClasses, scheduleExtraClasses } from "./extra-classes.js";
import { previewEndClasses, endClasses } from "./end-classes.js";
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
  previewExtra: adminProcedure.input(extraClassesSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => previewExtraClasses({ ...context(ctx), database }, input), {
      timeout: 30_000,
    }),
  ),
  scheduleExtra: adminProcedure
    .input(extraClassesSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) => scheduleExtraClasses({ ...context(ctx), database }, input),
        { timeout: 30_000 },
      ),
    ),
  previewEnd: adminProcedure.input(endClassesSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => previewEndClasses({ ...context(ctx), database }, input), {
      timeout: 30_000,
    }),
  ),
  endClasses: adminProcedure.input(confirmEndClassesSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => endClasses({ ...context(ctx), database }, input), {
      timeout: 30_000,
    }),
  ),
  prepare: staffProcedure.input(stagePlanTargetSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) => prepareProgramPlan({ ...context(ctx), database }, input), {
      timeout: 30_000,
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
      timeout: 30_000,
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
