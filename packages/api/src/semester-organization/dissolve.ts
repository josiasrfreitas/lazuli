import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { closeActiveEnrollment, lockStudentEnrollment } from "../enrollment/data.js";
import { cancelScheduledAction } from "../enrollment/scheduled.js";
import { withdrawPlacement } from "./publish.js";
import { recordPlacementRevision, type OrganizationContext } from "./data.js";

type Plan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
function closureDescription(name: string): string {
  return `A turma ${name} foi encerrada. É preciso definir um novo destino.`;
}
const reason = "Turma desfeita. Aguardando novo encaixe.";

/** The period and teaching-schedule locks are already held. Keep source memberships for future transfers. */
export async function releaseClassPlaces(context: OrganizationContext, plan: Plan): Promise<void> {
  const db = context.database;
  const today = new Date(saoPauloDateOnly(context.now));
  await releaseProposals(context, { planId: plan.id, name: plan.name, today });
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
  { planId, name, today }: { planId: string; name: string; today: Date },
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
        classClosurePending: true,
        continuity: row.continuity,
        continuityReason: row.continuityReason,
        publishedAt: null,
        publishedById: null,
        enrollmentId: null,
        entryActionId: null,
        sourceExitActionId: null,
        ...(wasEnrolled
          ? {
              mode: "ENTRY",
              effectiveDate: today,
            }
          : {}),
        version: { increment: 1 },
      },
    });
    await recordPlacementRevision(context, {
      id: row.id,
      action: "CLASS_DISSOLVED",
      reason: closureDescription(name),
    });
  }
}
export async function releaseEnrollments(
  context: OrganizationContext,
  { classId, semesterId, today }: { classId: string; semesterId: string; today: Date },
): Promise<void> {
  const db = context.database;
  const enrollments = await db.enrollment.findMany({
    where: { classId, deletedAt: null, OR: [{ exitDate: null }, { exitDate: { gt: today } }] },
    include: {
      progressRecords: {
        where: { deletedAt: null, OR: [{ endDate: null }, { endDate: { gt: today } }] },
        include: { stage: true },
      },
      class: {
        select: { portalClassName: true, sharedStage: { select: { id: true, trackId: true } } },
      },
      actions: { where: { status: "SCHEDULED", deletedAt: null } },
    },
    orderBy: { studentId: "asc" },
  });
  for (const enrollment of enrollments) {
    await lockStudentEnrollment(db, enrollment.studentId);
    const targets = enrollment.progressRecords.map((progress) => ({
      progressId: progress.id,
      stageId: progress.stageId,
      trackId: progress.stage.trackId,
    }));
    const fallback = {
      progressId: null,
      stageId: enrollment.class.sharedStage?.id ?? null,
      trackId: enrollment.class.sharedStage?.trackId ?? null,
    };
    for (const target of targets.length > 0 ? targets : [fallback]) {
      await flagEnrollmentClosure(context, { target, enrollment, semesterId, today });
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

type ClosureTarget = { progressId: string | null; stageId: string | null; trackId: string | null };
async function flagEnrollmentClosure(
  context: OrganizationContext,
  {
    target,
    enrollment,
    semesterId,
    today,
  }: {
    target: ClosureTarget;
    enrollment: {
      id: string;
      studentId: string;
      entryDate: Date;
      class: { portalClassName: string };
    };
    semesterId: string;
    today: Date;
  },
): Promise<void> {
  const db = context.database;
  const existing = await db.semesterPlacement.findFirst({
    where: {
      semesterId,
      studentId: enrollment.studentId,
      trackId: target.trackId,
      deletedAt: null,
    },
  });
  if (existing?.declinedAt || existing?.classClosurePending) return;
  const releaseMembership = existing?.enrollmentId === enrollment.id;
  const row = existing
    ? await db.semesterPlacement.update({
        where: { id: existing.id },
        data: {
          classClosurePending: true,
          version: { increment: 1 },
          ...(releaseMembership
            ? {
                planId: null,
                publishedAt: null,
                publishedById: null,
                enrollmentId: null,
                entryActionId: null,
                sourceExitActionId: null,
                sourceEnrollmentId: enrollment.id,
                sourceProgressId: target.progressId,
                mode: "ENTRY",
                effectiveDate: today,
              }
            : {}),
        },
      })
    : await db.semesterPlacement.create({
        data: {
          semesterId,
          studentId: enrollment.studentId,
          stageId: target.stageId,
          trackId: target.trackId,
          sourceEnrollmentId: enrollment.id,
          sourceProgressId: target.progressId,
          mode: "ENTRY",
          classClosurePending: true,
          effectiveDate: enrollment.entryDate > today ? enrollment.entryDate : today,
          recordedById: context.staffUser.id,
        },
      });
  await recordPlacementRevision(context, {
    id: row.id,
    action: "CLASS_DISSOLVED",
    reason: closureDescription(enrollment.class.portalClassName),
  });
}
