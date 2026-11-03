import type { Prisma, Period } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  lockSemester,
  dateOnly,
  readSlots,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";
import { recordActivity } from "../activity/record.js";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

type PreparationClass = Prisma.ClassGetPayload<{
  include: {
    scheduleSlots: true;
    teacherAssignments: true;
    enrollments: { include: { progressRecords: { include: { stage: true } } } };
  };
}>;
type PreparationEnrollment = PreparationClass["enrollments"][number];
type PreparationProgress = PreparationEnrollment["progressRecords"][number];
type ClassPlan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
type Placement = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;
type Slots = ReturnType<typeof readSlots>;
type PreparationScope = { semester: Period; source: Period; current: boolean };

/** Copy only missing records. Repeating this command never overwrites the coordinator's edits. */
export async function prepareSemester(
  context: OrganizationContext,
  semesterId: string,
): Promise<{ plans: number; students: number }> {
  const semester = await lockSemester(context, semesterId);
  const today = saoPauloDateOnly(context.now);
  const current = dateOnly(semester.startDate) <= today;
  const source = current
    ? semester
    : await context.database.period.findFirst({
        where: { deletedAt: null, startDate: { lt: semester.startDate } },
        orderBy: { startDate: "desc" },
      });
  if (!source) return { plans: 0, students: 0 };
  const scope = { semester, source, current };
  const classes = await preparationClasses(context, { sourceId: source.id, today });
  let plans = 0;
  let students = 0;
  for (const group of classes) {
    const added = await prepareGroup(context, { scope, group });
    plans += added.plans;
    students += added.students;
  }
  if (!current) {
    students += await carryWaitingPlacements(context, scope);
  }
  if (plans || students)
    await recordActivity(context.database, {
      context,
      action: "semesterOrganization.prepare",
      details: {
        subject: { type: "school", name: semester.name },
        description: `${plans} turma(s) e ${students} aluno(s) incorporados. Alterações anteriores preservadas.`,
      },
    });
  return { plans, students };
}

async function preparationClasses(
  context: OrganizationContext,
  { sourceId, today }: { sourceId: string; today: string },
): Promise<PreparationClass[]> {
  return context.database.class.findMany({
    where: { semesterId: sourceId, deletedAt: null, status: "ACTIVE" },
    include: {
      scheduleSlots: { where: { deletedAt: null } },
      teacherAssignments: {
        where: { deletedAt: null, supersededAt: null, effectiveDate: { lte: new Date(today) } },
        orderBy: { effectiveDate: "desc" },
        take: 1,
      },
      enrollments: {
        where: {
          deletedAt: null,
          OR: [{ exitDate: null }, { exitDate: { gt: new Date(today) } }],
          entryDate: { lte: new Date(today) },
          student: { deletedAt: null, status: "ACTIVE" },
        },
        include: {
          progressRecords: {
            where: {
              deletedAt: null,
              startDate: { lte: new Date(today) },
              OR: [{ endDate: null }, { endDate: { gte: new Date(today) } }],
            },
            include: { stage: true },
          },
        },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
}

async function prepareGroup(
  context: OrganizationContext,
  { scope, group }: { scope: PreparationScope; group: PreparationClass },
): Promise<{ plans: number; students: number }> {
  const slots: Slots = group.scheduleSlots.map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  }));
  if (slots.length === 0) return { plans: 0, students: 0 };
  const { plan, created } = await preparationPlan(context, { scope, group, slots });
  let students = 0;
  for (const enrollment of group.enrollments)
    for (const progress of enrollment.progressRecords)
      if (await prepareProgress(context, { scope, group, slots, plan, enrollment, progress }))
        students++;
  return { plans: created ? 1 : 0, students };
}

async function preparationPlan(
  context: OrganizationContext,
  { scope, group, slots }: { scope: PreparationScope; group: PreparationClass; slots: Slots },
): Promise<{ plan: ClassPlan; created: boolean }> {
  const plan = await context.database.semesterClassPlan.findFirst({
    where: {
      semesterId: scope.semester.id,
      deletedAt: null,
      OR: [
        { sourceClassId: group.id },
        { classId: group.id },
        { placements: { some: { deletedAt: null, sourceEnrollment: { classId: group.id } } } },
      ],
    },
  });
  if (plan) return { plan, created: false };
  const created = await context.database.semesterClassPlan.create({
    data: {
      semesterId: scope.semester.id,
      sourceClassId: group.id,
      classId: scope.current ? group.id : null,
      name: group.portalClassName,
      scheduleType: group.scheduleType,
      format: group.format,
      sharedStageId: group.sharedStageId,
      teacherId: group.teacherAssignments[0]?.teacherId ?? group.teacherId,
      slots,
      recordedById: context.staffUser.id,
    },
  });
  return { plan: created, created: true };
}

async function prepareProgress(
  context: OrganizationContext,
  {
    scope,
    plan,
    enrollment,
    progress,
  }: {
    scope: PreparationScope;
    group: PreparationClass;
    slots: Slots;
    plan: ClassPlan;
    enrollment: PreparationEnrollment;
    progress: PreparationProgress;
  },
): Promise<boolean> {
  const exists = await context.database.semesterPlacement.findFirst({
    where: {
      semesterId: scope.semester.id,
      studentId: enrollment.studentId,
      trackId: progress.stage.trackId,
      deletedAt: null,
    },
  });
  if (exists) return false;
  const previous = await previousProgressPlacement(context, { scope, enrollment, progress });
  await persistPreparedProgress(context, { scope, plan, enrollment, progress, previous });
  return true;
}

async function persistPreparedProgress(
  context: OrganizationContext,
  {
    scope,
    plan,
    enrollment,
    progress,
    previous,
  }: {
    scope: PreparationScope;
    plan: ClassPlan;
    enrollment: PreparationEnrollment;
    progress: PreparationProgress;
    previous: Placement | null;
  },
): Promise<void> {
  const row = await context.database.semesterPlacement.create({
    data: preparedPlacementData(context, { scope, plan, enrollment, progress, previous }),
  });
  await recordPlacementRevision(context, { id: row.id, action: "INHERITED" });
}

function preparedPlacementData(
  context: OrganizationContext,
  {
    scope,
    plan,
    enrollment,
    progress,
    previous,
  }: {
    scope: PreparationScope;
    plan: ClassPlan;
    enrollment: PreparationEnrollment;
    progress: PreparationProgress;
    previous: Placement | null;
  },
): Prisma.SemesterPlacementUncheckedCreateInput {
  return {
    semesterId: scope.semester.id,
    ...inheritedContinuity(previous, plan),
    studentId: enrollment.studentId,
    trackId: progress.stage.trackId,
    stageId: progress.stageId,
    sourceProgressId: progress.id,
    sourceEnrollmentId: enrollment.id,
    mode: "CONTINUE",
    effectiveDate: scope.current ? enrollment.entryDate : scope.semester.startDate,
    recordedById: context.staffUser.id,
    ...(scope.current
      ? {
          publishedAt: context.now,
          publishedById: context.staffUser.id,
          enrollmentId: enrollment.id,
        }
      : {}),
  };
}

function inheritedContinuity(
  previous: Placement | null,
  plan: ClassPlan,
): Pick<
  Prisma.SemesterPlacementUncheckedCreateInput,
  "planId" | "continuity" | "continuityReason"
> {
  if (!previous || previous.continuity === "STAY")
    return { planId: plan.id, continuity: "UNDECIDED", continuityReason: null };
  return {
    planId: previous.continuity === "CHANGE" ? null : plan.id,
    continuity: previous.continuity,
    continuityReason: previous.continuityReason,
  };
}

async function previousProgressPlacement(
  context: OrganizationContext,
  {
    scope,
    enrollment,
    progress,
  }: {
    scope: PreparationScope;
    enrollment: PreparationEnrollment;
    progress: PreparationProgress;
  },
): Promise<Placement | null> {
  if (scope.current) return null;
  return context.database.semesterPlacement.findFirst({
    where: {
      semesterId: scope.source.id,
      studentId: enrollment.studentId,
      trackId: progress.stage.trackId,
      deletedAt: null,
    },
  });
}

async function carryWaitingPlacements(
  context: OrganizationContext,
  scope: PreparationScope,
): Promise<number> {
  const waiting = await context.database.semesterPlacement.findMany({
    where: {
      semesterId: scope.source.id,
      deletedAt: null,
      declinedAt: null,
      publishedAt: null,
      sourceEnrollmentId: { not: null },
    },
  });
  let students = 0;
  for (const previous of waiting)
    if (await carryWaitingPlacement(context, { scope, previous })) students++;
  return students;
}

async function carryWaitingPlacement(
  context: OrganizationContext,
  { scope, previous }: { scope: PreparationScope; previous: Placement },
): Promise<boolean> {
  const existing = await context.database.semesterPlacement.findFirst({
    where: {
      semesterId: scope.semester.id,
      studentId: previous.studentId,
      trackId: previous.trackId,
      deletedAt: null,
    },
  });
  if (existing) return false;
  const row = await context.database.semesterPlacement.create({
    data: {
      semesterId: scope.semester.id,
      studentId: previous.studentId,
      trackId: previous.trackId,
      stageId: previous.stageId,
      sourceProgressId: previous.sourceProgressId,
      sourceEnrollmentId: previous.sourceEnrollmentId,
      mode: previous.mode,
      notes: previous.notes,
      effectiveDate: scope.semester.startDate,
      continuity: previous.continuity === "STAY" ? "UNDECIDED" : previous.continuity,
      continuityReason: previous.continuity === "STAY" ? null : previous.continuityReason,
      recordedById: context.staffUser.id,
    },
  });
  await recordPlacementRevision(context, { id: row.id, action: "CARRIED_FORWARD" });
  return true;
}
