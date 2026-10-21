import { searchIds } from "../search.js";
import { enrollmentSubject, enrollmentActionSubject } from "../activity/subjects.js";
import { activityTransaction } from "../activity/record.js";
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
    activityTransaction(
      ctx,
      "enrollment.create",
      (database) =>
        createEnrollment({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (result, database) => ({
        subject: await enrollmentSubject(database, result.enrollment.id),
        deduplicationKey: `enrollment.create:${result.enrollment.id}`,
      }),
    ),
  ),
  advanceStage: enrollmentProcedure
    .input(enrollmentAdvanceStageInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "enrollment.advanceStage",
        (database) =>
          advanceStage({ database, enrollmentId: input.enrollmentId, now: ctx.now ?? new Date() }),
        async (_result, database) => ({
          subject: await enrollmentSubject(database, input.enrollmentId),
        }),
      ),
    ),
  close: enrollmentProcedure.input(enrollmentCloseInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "enrollment.close",
      (database) =>
        closeEnrollment({
          database,
          enrollmentId: input.enrollmentId,
          reason: input.reason,
          ...(input.effectiveDate ? { effectiveDate: input.effectiveDate } : {}),
          staffUserId: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (_result, database) => ({
        subject: await enrollmentSubject(database, input.enrollmentId),
        description: input.reason === "SUSPENDED" ? "Pausa da matrícula." : "Saída da matrícula.",
      }),
    ),
  ),
  cancelScheduled: enrollmentProcedure
    .input(enrollmentCancelScheduledInputSchema)
    .mutation(({ ctx, input }) =>
      activityTransaction(
        ctx,
        "enrollment.cancelScheduled",
        (database) =>
          cancelScheduledAction({
            database,
            actionId: input.actionId,
            staffUserId: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          }),
        async (_result, database) => ({
          subject: await enrollmentActionSubject(database, input.actionId),
        }),
      ),
    ),
  return: enrollmentProcedure.input(enrollmentReturnInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "enrollment.return",
      (database) =>
        returnEnrollment({
          database,
          values: input,
          staffUserId: ctx.staffUser.id,
          now: ctx.now ?? new Date(),
        }),
      async (result, database) => ({
        subject: await enrollmentSubject(database, result.enrollment.id),
        deduplicationKey: `enrollment.return:${result.enrollment.id}`,
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
      activityTransaction(
        ctx,
        "enrollment.applyCorrection",
        (database) =>
          applyEnrollmentCorrection({
            database,
            values: input,
            staffUserId: ctx.staffUser.id,
            now: ctx.now ?? new Date(),
          }),
        async (_result, database) => ({
          subject: await enrollmentActionSubject(database, input.actionId),
          description: input.justification,
        }),
        { isolationLevel: "Serializable" },
      ),
    ),
  pausedSearch: enrollmentProcedure
    .input(enrollmentPausedSearchInputSchema)
    .query(async ({ ctx, input }) =>
      ctx.db.enrollment.findMany({
        where: {
          deletedAt: null,
          exitReason: "SUSPENDED",
          exitDate: { lte: new Date(saoPauloDateOnly(ctx.now ?? new Date())) },
          student: { id: (await searchIds(ctx.db, "Student", input.query)) ?? {} },
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
  transfer: enrollmentProcedure.input(enrollmentTransferInputSchema).mutation(({ ctx, input }) =>
    activityTransaction(
      ctx,
      "enrollment.transfer",
      (database) => transferEnrollment({ database, values: input }),
      async (result, database) => ({
        subject: await enrollmentSubject(database, result.enrollment.id),
        deduplicationKey: `enrollment.transfer:${result.enrollment.id}`,
      }),
    ),
  ),
});
