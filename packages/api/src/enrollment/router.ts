import {
  enrollmentAdvanceStageInputSchema,
  enrollmentCloseInputSchema,
  enrollmentCancelScheduledInputSchema,
  enrollmentReturnInputSchema,
  enrollmentCorrectionPreviewInputSchema,
  enrollmentCorrectionApplyInputSchema,
  enrollmentPausedSearchInputSchema,
  enrollmentCreateInputSchema,
  enrollmentCandidateSearchInputSchema,
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
import { searchEnrollmentCandidates } from "./search-candidates.js";
import { TRACK_ENROLLMENT_CONFLICT_MESSAGE } from "./errors.js";
import { badRequest } from "../trpc/errors.js";

const enrollmentProcedure = adminProcedure.use(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.message.includes("Enrollment_active_student_track_key")) {
    throw badRequest(TRACK_ENROLLMENT_CONFLICT_MESSAGE);
  }
  return result;
});

export const enrollmentRouter = router({
  searchCandidates: enrollmentProcedure
    .input(enrollmentCandidateSearchInputSchema)
    .query(({ ctx, input }) =>
      searchEnrollmentCandidates({ database: ctx.db, values: input, now: ctx.now ?? new Date() }),
    ),
  create: enrollmentProcedure.input(enrollmentCreateInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      createEnrollment({
        database,
        values: input,
        staffUserId: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  advanceStage: enrollmentProcedure
    .input(enrollmentAdvanceStageInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) =>
        advanceStage({ database, enrollmentId: input.enrollmentId, now: ctx.now ?? new Date() }),
      ),
    ),
  close: enrollmentProcedure.input(enrollmentCloseInputSchema).mutation(({ ctx, input }) =>
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
  cancelScheduled: enrollmentProcedure
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
  return: enrollmentProcedure.input(enrollmentReturnInputSchema).mutation(({ ctx, input }) =>
    ctx.db.$transaction((database) =>
      returnEnrollment({
        database,
        values: input,
        staffUserId: ctx.staffUser.id,
        now: ctx.now ?? new Date(),
      }),
    ),
  ),
  previewCorrection: enrollmentProcedure
    .input(enrollmentCorrectionPreviewInputSchema)
    .query(({ ctx, input }) =>
      previewEnrollmentCorrection({ database: ctx.db, values: input, now: ctx.now ?? new Date() }),
    ),
  applyCorrection: enrollmentProcedure
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
  pausedSearch: enrollmentProcedure
    .input(enrollmentPausedSearchInputSchema)
    .query(({ ctx, input }) =>
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
          class: { select: { internalCode: true, portalClassName: true } },
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
  transfer: enrollmentProcedure
    .input(enrollmentTransferInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((database) => transferEnrollment({ database, values: input })),
    ),
});
