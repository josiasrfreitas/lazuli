import type { TransactionClient } from "@lazuli/db";
import type { Placement } from "./semester-placement-data.js";

export async function returnToReview(
  database: TransactionClient,
  input: { row: Placement; reason: string; now: Date },
): Promise<void> {
  const { row, reason, now } = input;
  await revokeEnrollment(database, input);
  await database.enrollmentAction.updateMany({
    where: {
      id: {
        in: [row.entryActionId, row.sourceExitActionId].filter(
          (id): id is string => id !== null && id !== "",
        ),
      },
      status: "SCHEDULED",
    },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordRevision(database, input);
  await database.semesterPlacement.update({
    where: { id: row.id },
    data: {
      version: { increment: 1 },
      publishedAt: null,
      publishedById: null,
      enrollmentId: null,
      entryActionId: null,
      sourceExitActionId: null,
      availabilityId: null,
    },
  });
  await database.activityEvent.create({
    data: {
      actorName: "Sistema",
      area: "PEDAGOGICAL",
      action: "semesterOrganization.requiresReview",
      title: "Alocação devolvida para revisão",
      subjectType: "student",
      subjectId: row.studentId,
      subjectName: row.student.fullName,
      description: reason,
      occurredAt: now,
      deduplicationKey: `semester-review:${row.id}:${row.version + 1}`,
    },
  });
}

async function revokeEnrollment(
  database: TransactionClient,
  { row, reason, now }: { row: Placement; reason: string; now: Date },
): Promise<void> {
  if (row.enrollmentId) {
    await database.admissionCandidate.updateMany({
      where: { enrollmentId: row.enrollmentId, status: "ENROLLED", deletedAt: null },
      data: {
        status: "WAITING",
        enrollmentId: null,
        allocationPendingAt: now,
        allocationPendingReason: reason,
        allocationPlanId: row.planId,
      },
    });
    await database.pedagogicalProgress.updateMany({
      where: { enrollmentId: row.enrollmentId, deletedAt: null },
      data: { deletedAt: now },
    });
    await database.enrollment.update({ where: { id: row.enrollmentId }, data: { deletedAt: now } });
  }
}
async function recordRevision(
  database: TransactionClient,
  { row, reason, now }: { row: Placement; reason: string; now: Date },
): Promise<void> {
  await database.semesterPlacementRevision.create({
    data: {
      placementId: row.id,
      version: row.version + 1,
      action: "REQUIRES_REVIEW",
      reason,
      createdAt: now,
      snapshot: {
        planId: row.planId,
        studentId: row.studentId,
        mode: row.mode,
        stageId: row.stageId,
        sourceProgressId: row.sourceProgressId,
        enrollmentId: row.enrollmentId,
        entryActionId: row.entryActionId,
        sourceExitActionId: row.sourceExitActionId,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      },
    },
  });
}
