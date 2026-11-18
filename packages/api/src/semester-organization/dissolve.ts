import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { closeActiveEnrollment, lockStudentEnrollment } from "../enrollment/data.js";
import { cancelScheduledAction } from "../enrollment/scheduled.js";
import { withdrawPlacement } from "./publish.js";
import { recordPlacementRevision, type OrganizationContext } from "./data.js";

type Plan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
const reason = "Turma desfeita. Aguardando novo encaixe.";

/** The period and teaching-schedule locks are already held. Keep source memberships for future transfers. */
export async function releaseClassPlaces(context: OrganizationContext, plan: Plan): Promise<void> {
  const db = context.database;
  const today = new Date(saoPauloDateOnly(context.now));
  await releaseProposals(context, { planId: plan.id, today });
  if (plan.classId)
    await releaseEnrollments(context, {
      classId: plan.classId,
      semesterId: plan.semesterId,
      today,
    });
  await db.admissionCandidate.updateMany({
    where: { allocationPlanId: plan.id, status: "WAITING", deletedAt: null },
    data: {
      allocationPlanId: null,
      allocationPendingAt: context.now,
      allocationPendingReason: reason,
    },
  });
}

async function releaseProposals(
  context: OrganizationContext,
  { planId, today }: { planId: string; today: Date },
): Promise<void> {
  const db = context.database;
  const proposals = await db.semesterPlacement.findMany({
    where: { planId, deletedAt: null, declinedAt: null },
    include: { entryAction: true },
    orderBy: { studentId: "asc" },
  });
  for (const row of proposals) {
    await lockStudentEnrollment(db, row.studentId);
    if (row.entryAction?.status === "SCHEDULED")
      await withdrawPlacement(context, { id: row.id, version: row.version, reason });
    const wasEnrolled =
      row.publishedAt && (!row.entryActionId || row.entryAction?.status === "APPLIED");
    await db.semesterPlacement.update({
      where: { id: row.id },
      data: {
        planId: null,
        continuity: "CHANGE",
        continuityReason: reason,
        publishedAt: null,
        publishedById: null,
        enrollmentId: null,
        entryActionId: null,
        sourceExitActionId: null,
        ...(wasEnrolled
          ? {
              sourceEnrollmentId: null,
              sourceProgressId: null,
              mode: "ENTRY",
              effectiveDate: today,
            }
          : {}),
        version: { increment: 1 },
      },
    });
    await recordPlacementRevision(context, { id: row.id, action: "CLASS_DISSOLVED", reason });
  }
}
async function releaseEnrollments(
  context: OrganizationContext,
  { classId, semesterId, today }: { classId: string; semesterId: string; today: Date },
): Promise<void> {
  const db = context.database;
  const enrollments = await db.enrollment.findMany({
    where: { classId, deletedAt: null, exitDate: null },
    include: {
      progressRecords: { where: { endDate: null, deletedAt: null }, include: { stage: true } },
      actions: { where: { status: "SCHEDULED", deletedAt: null } },
    },
    orderBy: { studentId: "asc" },
  });
  for (const enrollment of enrollments) {
    await lockStudentEnrollment(db, enrollment.studentId);
    for (const progress of enrollment.progressRecords) {
      const existing = await db.semesterPlacement.findFirst({
        where: {
          semesterId,
          studentId: enrollment.studentId,
          trackId: progress.stage.trackId,
          deletedAt: null,
        },
      });
      if (existing) continue;
      const row = await db.semesterPlacement.create({
        data: {
          semesterId,
          studentId: enrollment.studentId,
          stageId: progress.stageId,
          trackId: progress.stage.trackId,
          mode: "ENTRY",
          continuity: "CHANGE",
          continuityReason: reason,
          effectiveDate: enrollment.entryDate > today ? enrollment.entryDate : today,
          recordedById: context.staffUser.id,
        },
      });
      await recordPlacementRevision(context, { id: row.id, action: "CLASS_DISSOLVED", reason });
    }
    if (enrollment.entryDate > today) {
      for (const action of enrollment.actions)
        await cancelScheduledAction({
          database: db,
          actionId: action.id,
          staffUserId: context.staffUser.id,
          now: context.now,
        });
    } else {
      await closeActiveEnrollment({
        database: db,
        enrollmentId: enrollment.id,
        effectiveDate: today,
        reason: "SUSPENDED",
      });
      await db.enrollmentAction.create({
        data: {
          enrollmentId: enrollment.id,
          kind: "PAUSE",
          status: "APPLIED",
          effectiveDate: today,
          recordedById: context.staffUser.id,
          justification: reason,
        },
      });
    }
  }
  await db.class.update({ where: { id: classId }, data: { status: "ARCHIVED" } });
}
