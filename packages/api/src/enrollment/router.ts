import { enrollmentAdvanceStageInputSchema, enrollmentCreateInputSchema } from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { advanceStage } from "./advance.js";
import { createEnrollment } from "./data.js";

export const enrollmentRouter = router({
  create: adminProcedure
    .input(enrollmentCreateInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => createEnrollment({ database, values: input })),
    ),
  advanceStage: adminProcedure
    .input(enrollmentAdvanceStageInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        advanceStage({ database, enrollmentId: input.enrollmentId }),
      ),
    ),
});
