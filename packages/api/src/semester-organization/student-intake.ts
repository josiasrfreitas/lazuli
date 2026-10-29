import type { Prisma, Period, TransactionClient } from "@lazuli/db";
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
  const semester = await database.period.findFirst({
    where: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: "desc" },
  });
  if (semester)
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semester.id}`}, 0))`;
  return semester;
}

type SyncInput = {
  semester: Period | null;
  studentId: string;
  stageId: string | null;
  enrollmentId: string | null;
  candidate: AdmissionCandidate | null;
  recordedById: string;
  now: Date;
};
const intakeEnrollmentInclude = {
  class: { include: { scheduleSlots: { where: { deletedAt: null } } } },
  progressRecords: { where: { deletedAt: null, endDate: null }, take: 1 },
} satisfies Prisma.EnrollmentInclude;
type IntakeEnrollment = Prisma.EnrollmentGetPayload<{ include: typeof intakeEnrollmentInclude }>;
type IntakeSlots = ReturnType<typeof readSlots>;
type Stage = Prisma.StageGetPayload<Prisma.StageDefaultArgs>;
type ClassPlan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
type Placement = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;
type PlacementOptions = {
  semester: Period;
  studentId: string;
  candidate: AdmissionCandidate | null;
  enrollment: IntakeEnrollment | null;
  stage: Stage;
  slots: IntakeSlots;
  recordedById: string;
  now: Date;
};

/** Intake and the organization board describe the same enrollment or pending intention. */
export async function syncStudentIntake(
  database: TransactionClient,
  input: SyncInput,
): Promise<void> {
  const { semester, studentId, candidate, recordedById, now } = input;
  if (!semester) return;
  const enrollment = await loadIntakeEnrollment(database, input.enrollmentId);
  const stageId = input.stageId ?? candidate?.stageId;
  const stage = stageId ? await database.stage.findUnique({ where: { id: stageId } }) : null;
  const slots = intakeSlots(enrollment);
  if (!stage) return;
  await syncIntakePlacement(database, {
    semester,
    studentId,
    candidate,
    enrollment,
    stage,
    slots,
    recordedById,
    now,
  });
}

async function loadIntakeEnrollment(
  database: TransactionClient,
  enrollmentId: string | null,
): Promise<IntakeEnrollment | null> {
  if (!enrollmentId) return null;
  return database.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: intakeEnrollmentInclude,
  });
}

function intakeSlots(enrollment: IntakeEnrollment | null): IntakeSlots {
  return (enrollment?.class.scheduleSlots ?? []).map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  }));
}

async function syncIntakePlacement(
  database: TransactionClient,
  options: PlacementOptions,
): Promise<void> {
  const { semester, studentId, enrollment, stage, recordedById } = options;
  const plan = await intakePlan(database, options);
  const existing = await database.semesterPlacement.findFirst({
    where: { semesterId: semester.id, studentId, trackId: stage.trackId, deletedAt: null },
  });
  if (existing && !enrollment) return;
  const row = await writeIntakePlacement(database, { ...options, plan, existing });
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

async function intakePlan(
  database: TransactionClient,
  options: PlacementOptions,
): Promise<ClassPlan | null> {
  const { semester, enrollment, slots, recordedById } = options;
  if (!enrollment) return null;
  const plan = await database.semesterClassPlan.findFirst({
    where: { semesterId: semester.id, classId: enrollment.classId, deletedAt: null },
  });
  if (plan) return plan;
  return database.semesterClassPlan.create({
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
}

async function writeIntakePlacement(
  database: TransactionClient,
  {
    semester,
    studentId,
    candidate,
    enrollment,
    stage,
    recordedById,
    now,
    plan,
    existing,
  }: PlacementOptions & {
    plan: ClassPlan | null;
    existing: Placement | null;
  },
): Promise<Placement> {
  const data = {
    mode: enrollment ? ("CONTINUE" as const) : ("ENTRY" as const),
    stageId: stage.id,
    planId: intakePlacementPlanId({ plan, candidate, semester }),
    effectiveDate: enrollment?.entryDate ?? new Date(saoPauloDateOnly(now)),
    ...(enrollment
      ? {
          publishedAt: now,
          publishedById: recordedById,
          enrollmentId: enrollment.id,
          sourceEnrollmentId: enrollment.id,
          sourceProgressId: enrollment.progressRecords[0]?.id ?? null,
          continuity: "STAY" as const,
          continuityReason: null,
        }
      : {}),
  };
  return existing
    ? database.semesterPlacement.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      })
    : database.semesterPlacement.create({
        data: { ...data, semesterId: semester.id, studentId, trackId: stage.trackId, recordedById },
      });
}

function intakePlacementPlanId({
  plan,
  candidate,
  semester,
}: {
  plan: ClassPlan | null;
  candidate: AdmissionCandidate | null;
  semester: Period;
}): string | null {
  if (plan) return plan.id;
  return candidate?.allocationPlan?.semesterId === semester.id ? candidate.allocationPlan.id : null;
}
