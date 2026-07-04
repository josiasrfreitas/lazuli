import type { Prisma } from "@lazuli/db";
import { findNextStageInTrack } from "@lazuli/domain";

import { todayDateOnlyInSaoPaulo } from "../students/date-rules.js";
import { progressSummarySelect, type EnrollmentDatabase, type ProgressSummary } from "./data.js";
import {
  ACTIVE_PROGRESS_NOT_FOUND_MESSAGE,
  ADVANCE_REQUIRES_PERSONALIZED_MESSAGE,
  END_OF_TRACK_MESSAGE,
  ENROLLMENT_NOT_ACTIVE_MESSAGE,
  ENROLLMENT_NOT_FOUND_MESSAGE,
  badRequest,
  notFound,
} from "./errors.js";

// Active progress plus the ordered stages of its track, so `findNextStageInTrack` never leaves the
// track (S-ENR-4: no cross-track jump). `endDate IS NULL AND deletedAt IS NULL` mirrors the active
// partial unique index; the invariant guarantees exactly one such row per active enrollment.
const advanceableEnrollmentSelect = {
  id: true,
  exitDate: true,
  class: { select: { scheduleType: true } },
  progressRecords: {
    where: { endDate: null, deletedAt: null },
    select: {
      id: true,
      stageId: true,
      stage: {
        select: {
          track: {
            select: {
              stages: {
                where: { deletedAt: null },
                orderBy: { sequence: "asc" },
                select: { id: true, internalCode: true, sequence: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EnrollmentSelect;

type AdvanceableEnrollment = Prisma.EnrollmentGetPayload<{
  select: typeof advanceableEnrollmentSelect;
}>;

type ActiveProgress = AdvanceableEnrollment["progressRecords"][number];

export type AdvanceStageResult = {
  enrollmentId: string;
  previousProgress: { id: string; stageId: string; endDate: Date | null };
  progress: ProgressSummary;
};

/**
 * Advances a PERSONALIZED/PPT enrollment to the next `Stage` in the same `Track` (S-ENR-4).
 * Closes the active `PedagogicalProgress` (`ADVANCED`) and opens a new one at the next stage while
 * keeping the enrollment active. Pure academic move — it writes no finance rows (no billing side
 * effect). Runs inside the caller's transaction so the deferred one-active-progress invariant holds.
 */
export async function advanceStage(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
}): Promise<AdvanceStageResult> {
  const enrollment = await loadAdvanceableEnrollment(input);
  const activeProgress = requireActiveProgress(enrollment);
  const nextStageId = requireNextStageId(activeProgress);

  return closeAndOpenProgress({
    database: input.database,
    enrollmentId: enrollment.id,
    activeProgressId: activeProgress.id,
    nextStageId,
  });
}

async function loadAdvanceableEnrollment(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
}): Promise<AdvanceableEnrollment> {
  const enrollment = await input.database.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: advanceableEnrollmentSelect,
  });

  if (enrollment === null) {
    throw notFound(ENROLLMENT_NOT_FOUND_MESSAGE);
  }
  if (enrollment.exitDate !== null) {
    throw badRequest(ENROLLMENT_NOT_ACTIVE_MESSAGE);
  }
  if (enrollment.class.scheduleType !== "PERSONALIZED") {
    // REGULAR advances via clone-for-next-period (S-CLS-1); advancing it here would also break the
    // regular-stage-match DB invariant. Reject with a clean message instead of leaking a DB error.
    throw badRequest(ADVANCE_REQUIRES_PERSONALIZED_MESSAGE);
  }
  return enrollment;
}

function requireActiveProgress(enrollment: AdvanceableEnrollment): ActiveProgress {
  const [activeProgress] = enrollment.progressRecords;
  if (activeProgress === undefined) {
    throw badRequest(ACTIVE_PROGRESS_NOT_FOUND_MESSAGE);
  }
  return activeProgress;
}

function requireNextStageId(activeProgress: ActiveProgress): string {
  const nextStage = findNextStageInTrack({
    stages: activeProgress.stage.track.stages,
    currentStageId: activeProgress.stageId,
  });
  if (nextStage === null) {
    throw badRequest(END_OF_TRACK_MESSAGE);
  }
  return nextStage.id;
}

async function closeAndOpenProgress(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
  activeProgressId: string;
  nextStageId: string;
}): Promise<AdvanceStageResult> {
  // The no-overlap exclusion uses inclusive date ranges, so the closed record and the new one cannot
  // share a day: close today, start the next stage tomorrow. Close before create to respect the
  // one-active-progress partial unique index. Progress dates are structural history only.
  const closeDate = new Date(todayDateOnlyInSaoPaulo());
  const nextStartDate = addOneDay(closeDate);

  const previousProgress = await input.database.pedagogicalProgress.update({
    where: { id: input.activeProgressId },
    data: { endDate: closeDate, endReason: "ADVANCED" },
    select: { id: true, stageId: true, endDate: true },
  });
  const progress = await input.database.pedagogicalProgress.create({
    data: {
      enrollmentId: input.enrollmentId,
      stageId: input.nextStageId,
      startDate: nextStartDate,
    },
    select: progressSummarySelect,
  });

  return { enrollmentId: input.enrollmentId, previousProgress, progress };
}

function addOneDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
