import {
  enrollmentAdvanceStageInputSchema,
  enrollmentCloseInputSchema,
  enrollmentCreateInputSchema,
  enrollmentTransferInputSchema,
} from "@lazuli/validators";

import { adminProcedure, router } from "../trpc/init.js";
import { advanceStage } from "./advance.js";
import { closeEnrollment } from "./close.js";
import { createEnrollment } from "./data.js";
import { transferEnrollment } from "./transfer.js";

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
  close: adminProcedure
    .input(enrollmentCloseInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        closeEnrollment({ database, enrollmentId: input.enrollmentId, reason: input.reason }),
      ),
    ),
  transfer: adminProcedure
    .input(enrollmentTransferInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => transferEnrollment({ database, values: input })),
    ),
});
