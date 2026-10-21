import type { Prisma, TransactionClient } from "@lazuli/db";
import {
  semesterPlacementBlockers,
  effectiveTeacherId,
  type SemesterEligibility,
} from "@lazuli/domain";
import { classScheduleSlotInputSchema, z } from "@lazuli/validators";

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const slots = (value: unknown) => z.array(classScheduleSlotInputSchema).parse(value);
const include = {
  student: true,
  stage: { include: { track: true } },
  sourceEnrollment: { include: { class: true } },
  sourceProgress: { include: { stage: true, assessment: true } },
  enrollment: {
    include: {
      class: {
        include: {
          teacher: { include: { teacherProfile: true } },
          teacherAssignments: {
            where: { supersededAt: null, deletedAt: null },
            include: { teacher: { include: { teacherProfile: true } } },
          },
          scheduleSlots: { where: { deletedAt: null } },
        },
      },
    },
  },
  entryAction: true,
  sourceExitAction: true,
} satisfies Prisma.SemesterPlacementInclude;
type Placement = Prisma.SemesterPlacementGetPayload<{ include: typeof include }>;

/** Run in the same transaction before due enrollment actions. A changed premise must not move a student. */
export async function reconcileDueSemesterPlacements(
  database: TransactionClient,
  today: Date,
  now: Date,
) {
  const candidates = await database.semesterPlacement.findMany({
    where: {
      publishedAt: { not: null },
      entryAction: { status: "SCHEDULED", effectiveDate: { lte: today } },
    },
    select: { id: true, semesterId: true, studentId: true },
    orderBy: [{ semesterId: "asc" }, { studentId: "asc" }],
  });
  for (const candidate of candidates) {
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${candidate.semesterId}`}, 0))`;
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`enrollment:${candidate.studentId.toLowerCase()}`}, 0))`;
    const row = await database.semesterPlacement.findUniqueOrThrow({
      where: { id: candidate.id },
      include,
    });
    if (!row.publishedAt || row.entryAction?.status !== "SCHEDULED") continue;
    const availability = await database.studentAvailability.findFirst({
      where: { studentId: row.studentId, semesterId: row.semesterId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const blockers = semesterPlacementBlockers(eligibility(row, availability));
    if (row.sourceEnrollmentId && row.sourceExitAction?.status !== "SCHEDULED")
      blockers.push("A saída de origem foi alterada");
    const evidence = z
      .object({ assessmentId: z.string().nullable(), stagePlanId: z.string().nullable() })
      .safeParse(row.publishedEvidence);
    if (
      row.mode === "CONTINUE" &&
      evidence.success &&
      (evidence.data.assessmentId !== row.sourceProgress?.assessmentId ||
        evidence.data.stagePlanId !== row.sourceProgress?.stagePlanId)
    )
      blockers.push("O plano ou a avaliação PPT mudou após a publicação");
    if (blockers.length) await returnToReview(database, row, blockers.join("; "), now);
  }
}
function eligibility(
  row: Placement,
  availability: { confirmed: boolean; validUntil: Date; formats: string[]; slots: unknown } | null,
): SemesterEligibility {
  const source = row.sourceProgress;
  const target = row.enrollment?.class;
  const entryOn = dateOnly(row.entryAction!.effectiveDate);
  const teachers = target
    ? [target.teacher, ...target.teacherAssignments.map((item) => item.teacher)]
    : [];
  const teacherId = target
    ? effectiveTeacherId({
        initialTeacherId: target.teacherId,
        assignments: target.teacherAssignments.map((item) => ({
          teacherId: item.teacherId,
          effectiveDate: dateOnly(item.effectiveDate),
        })),
        departureDates: new Map(
          teachers.map((teacher) => [
            teacher.id,
            teacher.teacherProfile?.departureDate
              ? dateOnly(teacher.teacherProfile.departureDate)
              : null,
          ]),
        ),
        date: entryOn,
      })
    : null;
  return {
    entryOn,
    semesterId: row.semesterId,
    studentActive: row.student.status === "ACTIVE" && !row.student.deletedAt,
    mode: row.mode,
    stage:
      row.stage && !row.stage.deletedAt && row.stage.track.status === "ACTIVE"
        ? { id: row.stage.id, trackId: row.stage.trackId, sequence: row.stage.sequence }
        : null,
    source:
      source && row.sourceEnrollment
        ? {
            semesterId: row.sourceEnrollment.class.semesterId,
            active:
              !source.deletedAt &&
              !source.endDate &&
              !row.sourceEnrollment.deletedAt &&
              !row.sourceEnrollment.exitDate,
            stageId: source.stageId,
            trackId: source.stage.trackId,
            sequence: source.stage.sequence,
            scheduleType: row.sourceEnrollment.class.scheduleType,
            decision: source.assessment?.decision ?? null,
            confirmed: Boolean(source.assessment?.confirmedAt && !source.assessment.deletedAt),
          }
        : null,
    plan: target
      ? {
          scheduleType: target.scheduleType,
          sharedStageId: target.sharedStageId,
          format: target.format,
          slots: target.scheduleSlots.map((slot) => ({
            weekday: slot.weekday,
            startTime: slot.startTime.toISOString().slice(11, 16),
            endTime: slot.endTime.toISOString().slice(11, 16),
          })),
          teacherReady: Boolean(
            teacherId && teachers.some((teacher) => teacher.id === teacherId && !teacher.deletedAt),
          ),
          active: target.status === "ACTIVE" && !target.deletedAt && !row.enrollment?.deletedAt,
        }
      : null,
    availability: availability
      ? {
          confirmed: availability.confirmed,
          validUntil: dateOnly(availability.validUntil),
          formats: availability.formats,
          slots: slots(availability.slots),
        }
      : null,
  };
}
async function returnToReview(
  database: TransactionClient,
  row: Placement,
  reason: string,
  now: Date,
) {
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
  await database.enrollmentAction.updateMany({
    where: {
      id: {
        in: [row.entryActionId, row.sourceExitActionId].filter((id): id is string => Boolean(id)),
      },
      status: "SCHEDULED",
    },
    data: { status: "CANCELLED", cancelledAt: now },
  });
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
