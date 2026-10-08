import {
  enrollmentAdvanceStageInputSchema,
  enrollmentCloseInputSchema,
  enrollmentCancelScheduledInputSchema,
  enrollmentReturnInputSchema,
  enrollmentCorrectionPreviewInputSchema,
  enrollmentCorrectionApplyInputSchema,
  enrollmentPausedSearchInputSchema,
  enrollmentCreateInputSchema,
  enrollmentTransferInputSchema,
} from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";

import { adminProcedure, router } from "../trpc/init.js";
import { advanceStage } from "./advance.js";
import { closeEnrollment } from "./close.js";
import { cancelScheduledAction } from "./scheduled.js";
import { returnEnrollment } from "./return.js";
import { applyEnrollmentCorrection, previewEnrollmentCorrection } from "./correction.js";
import { createEnrollment } from "./data.js";
import { transferEnrollment } from "./transfer.js";

export const enrollmentRouter = router({
  create: adminProcedure.input(enrollmentCreateInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createEnrollment({
        database,
        values: input,
        staffUserId: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  advanceStage: adminProcedure
    .input(enrollmentAdvanceStageInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        advanceStage({ database, enrollmentId: input.enrollmentId, now: ctx.now ?? new Date() }),
      ),
    ),
  close: adminProcedure.input(enrollmentCloseInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      closeEnrollment({
        database,
        enrollmentId: input.enrollmentId,
        reason: input.reason,
        ...(input.effectiveDate ? { effectiveDate: input.effectiveDate } : {}),
        staffUserId: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  cancelScheduled: adminProcedure
    .input(enrollmentCancelScheduledInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        cancelScheduledAction({
          database,
          actionId: input.actionId,
          staffUserId: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      ),
    ),
  return: adminProcedure.input(enrollmentReturnInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      returnEnrollment({
        database,
        values: input,
        staffUserId: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  previewCorrection: adminProcedure
    .input(enrollmentCorrectionPreviewInputSchema)
    .query(({ ctx, input }) =>
      previewEnrollmentCorrection({ database: ctx.db, values: input, now: ctx.now ?? new Date() }),
    ),
  applyCorrection: adminProcedure
    .input(enrollmentCorrectionApplyInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(
        (database) =>
          applyEnrollmentCorrection({
            database,
            values: input,
            staffUserId: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          }),
        { isolationLevel: "Serializable" },
      ),
    ),
  pausedSearch: adminProcedure.input(enrollmentPausedSearchInputSchema).query(({ ctx, input }) =>
    ctx.db.enrollment.findMany({
      where: {
        deletedAt: null,
        exitReason: "SUSPENDED",
        exitDate: { lte: new Date(saoPauloDateOnly(ctx.now ?? new Date())) },
        student: { fullName: { contains: input.query, mode: "insensitive" } },
        returnActions: { none: { status: { in: ["SCHEDULED", "APPLIED"] } } },
      },
      select: {
        id: true,
        student: { select: { fullName: true } },
        class: { select: { internalCode: true } },
        exitDate: true,
        progressRecords: {
          where: { deletedAt: null },
          select: { stage: { select: { name: true } } },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
      orderBy: { exitDate: "desc" },
      take: 20,
    }),
  ),
  transfer: adminProcedure
    .input(enrollmentTransferInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => transferEnrollment({ database, values: input })),
    ),
});
