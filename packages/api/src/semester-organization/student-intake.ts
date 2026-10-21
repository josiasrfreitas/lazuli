import type { Semester, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { AdmissionCandidate } from "../admissions/candidates.js";
import { readSlots } from "./data.js";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

/** Keep the same lock order as allocation: period, teaching schedule, student. */
export async function lockIntakeSemester(
  database: TransactionClient,
  now: Date,
): Promise<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  name: string;
  startDate: Date;
  endDate: Date;
} | null> {
  const today = new Date(saoPauloDateOnly(now));
  const semester = await database.semester.findFirst({
    where: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: "desc" },
  });
  if (semester)
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semester.id}`}, 0))`;
  return semester;
}

/** Intake and the organization board describe the same enrollment or pending intention. */
export async function syncStudentIntake(
  database: TransactionClient,
  input: {
    semester: Semester | null;
    studentId: string;
    stageId: string | null;
    enrollmentId: string | null;
    candidate: AdmissionCandidate | null;
    recordedById: string;
    now: Date;
  },
): Promise<void> {
  const { semester, studentId, candidate, recordedById, now } = input;
  if (!semester) return;
  const enrollment = input.enrollmentId
    ? await database.enrollment.findUniqueOrThrow({
        where: { id: input.enrollmentId },
        include: {
          class: { include: { scheduleSlots: { where: { deletedAt: null } } } },
          progressRecords: { where: { deletedAt: null, endDate: null }, take: 1 },
        },
      })
    : null;
  const stageId = input.stageId ?? candidate?.stageId;
  const stage = stageId ? await database.stage.findUnique({ where: { id: stageId } }) : null;
  const slots = (enrollment?.class.scheduleSlots ?? candidate?.availability ?? []).map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  }));
  const available = await database.studentAvailability.findFirst({
    where: { semesterId: semester.id, studentId, deletedAt: null },
  });
  if (!available)
    await database.studentAvailability.create({
      data: {
        semesterId: semester.id,
        studentId,
        validUntil: semester.endDate,
        formats: enrollment
          ? [enrollment.class.format]
          : candidate?.format
            ? [candidate.format]
            : ["IN_PERSON", "ONLINE"],
        slots: readSlots(slots),
        confirmed: slots.length > 0,
        notes: candidate?.allocationPendingReason ?? candidate?.notes ?? null,
        recordedById,
      },
    });
  if (!stage) return;
  let plan = enrollment
    ? await database.semesterClassPlan.findFirst({
        where: { semesterId: semester.id, classId: enrollment.classId, deletedAt: null },
      })
    : null;
  if (enrollment && !plan)
    plan = await database.semesterClassPlan.create({
      data: {
        semesterId: semester.id,
        classId: enrollment.classId,
        sourceClassId: enrollment.classId,
        name: enrollment.class.portalClassName,
        scheduleType: enrollment.class.scheduleType,
        format: enrollment.class.format,
        sharedStageId: enrollment.class.sharedStageId,
        teacherId: enrollment.class.teacherId,
        slots: readSlots(slots),
        recordedById,
      },
    });
  const existing = await database.semesterPlacement.findFirst({
    where: { semesterId: semester.id, studentId, trackId: stage.trackId, deletedAt: null },
  });
  if (existing && !enrollment) return;
  const data = {
    mode: enrollment ? ("CONTINUE" as const) : ("ENTRY" as const),
    stageId: stage.id,
    planId:
      plan?.id ??
      (candidate?.allocationPlan?.semesterId === semester.id ? candidate.allocationPlan.id : null),
    effectiveDate: enrollment?.entryDate ?? new Date(saoPauloDateOnly(now)),
    ...(enrollment
      ? {
          publishedAt: now,
          publishedById: recordedById,
          enrollmentId: enrollment.id,
          sourceEnrollmentId: enrollment.id,
          sourceProgressId: enrollment.progressRecords[0]?.id ?? null,
          continuity: "STAY",
          continuityReason: null,
        }
      : {}),
  };
  const row = existing
    ? await database.semesterPlacement.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await database.semesterPlacement.create({
        data: {
          ...data,
          semesterId: semester.id,
          studentId,
          trackId: stage.trackId,
          recordedById,
        },
      });
  await database.semesterPlacementRevision.create({
    data: {
      placementId: row.id,
      version: row.version,
      action: enrollment ? "ENROLLED" : "PROPOSED",
      recordedById,
      snapshot: {
        studentId,
        stageId: stage.id,
        planId: row.planId,
        enrollmentId: row.enrollmentId,
        continuity: row.continuity,
      },
    },
  });
}
