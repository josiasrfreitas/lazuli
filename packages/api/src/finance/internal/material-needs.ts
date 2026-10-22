import { stageMaterialAttention } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";

const enrollmentSelect = {
  id: true,
  class: {
    select: {
      id: true,
      portalClassName: true,
      scheduleType: true,
      sharedStageId: true,
      stagePlan: { select: { stageId: true, plannedEndOn: true, deletedAt: true } },
    },
  },
  sourceSemesterPlacements: {
    where: { deletedAt: null, declinedAt: null, semester: { deletedAt: null } },
    orderBy: [{ semester: { startDate: "asc" } }, { effectiveDate: "asc" }, { id: "asc" }],
    take: 1,
    select: { stage: { select: { id: true, name: true } } },
  },
  progressRecords: {
    where: { deletedAt: null },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
    take: 1,
    select: {
      id: true,
      stage: { select: { id: true, name: true, trackId: true, sequence: true } },
      stagePlan: {
        select: { studentId: true, stageId: true, plannedEndOn: true, deletedAt: true },
      },
    },
  },
} satisfies Prisma.EnrollmentSelect;
type Enrollment = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;
type Progress = Enrollment["progressRecords"][number];
type Stage = { id: string; name: string; sequence: number; trackId: string };
type MaterialNeed = {
  id: string;
  classId: string;
  className: string;
  mode: Enrollment["class"]["scheduleType"];
  currentStage: string;
  nextStage: string | null;
  plannedEndOn: string;
  timing: "soon" | "due";
  stagePending: boolean;
};

/** Read academic plans and organization decisions; finance never advances an enrollment. */
export async function readMaterialNeeds(
  database: FinanceDatabase,
  options: { studentId: string; asOf: string },
): Promise<MaterialNeed[]> {
  const { studentId, asOf } = options;
  const today = new Date(asOf);
  const [enrollments, sales] = await Promise.all([
    activeEnrollments(database, { studentId, today }),
    database.materialOrder.findMany({
      where: {
        order: { deletedAt: null, cancelledAt: null, contract: { studentId, deletedAt: null } },
      },
      select: { stageId: true, items: { select: { stageId: true } } },
    }),
  ]);
  const acquiredStageIds = sales.flatMap((sale) =>
    sale.items.length > 0 ? sale.items.map((item) => item.stageId) : [sale.stageId],
  );
  const stages = await relevantStages(database, enrollments);
  return enrollments.flatMap((enrollment) =>
    projectMaterialNeed({ enrollment, studentId, asOf, acquiredStageIds, stages }),
  );
}

async function activeEnrollments(
  database: FinanceDatabase,
  options: { studentId: string; today: Date },
): Promise<Enrollment[]> {
  const { studentId, today } = options;
  return database.enrollment.findMany({
    where: {
      studentId,
      deletedAt: null,
      entryDate: { lte: today },
      OR: [{ exitDate: null }, { exitDate: { gt: today } }],
      class: { deletedAt: null },
    },
    select: {
      ...enrollmentSelect,
      sourceSemesterPlacements: {
        ...enrollmentSelect.sourceSemesterPlacements,
        where: {
          ...enrollmentSelect.sourceSemesterPlacements.where,
          OR: [
            { effectiveDate: { gt: today } },
            { effectiveDate: null, semester: { startDate: { gt: today } } },
          ],
        },
      },
      progressRecords: {
        ...enrollmentSelect.progressRecords,
        where: {
          ...enrollmentSelect.progressRecords.where,
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gt: today } }],
        },
      },
    },
  });
}

async function relevantStages(
  database: FinanceDatabase,
  enrollments: Enrollment[],
): Promise<Stage[]> {
  const tracks = [
    ...new Set(
      enrollments.flatMap((row) => row.progressRecords.map((progress) => progress.stage.trackId)),
    ),
  ];
  if (tracks.length === 0) return [];
  return database.stage.findMany({
    where: { trackId: { in: tracks }, deletedAt: null },
    select: { id: true, name: true, sequence: true, trackId: true },
    orderBy: { sequence: "asc" },
  });
}

function projectMaterialNeed(input: {
  enrollment: Enrollment;
  studentId: string;
  asOf: string;
  acquiredStageIds: string[];
  stages: Stage[];
}): MaterialNeed[] {
  const { enrollment, studentId, asOf, acquiredStageIds, stages } = input;
  const progress = enrollment.progressRecords[0];
  if (!progress) return [];
  const plannedEndOn = materialPlannedEnd({ enrollment, progress, studentId });
  if (!plannedEndOn) return [];
  const nextResult = nextMaterialStage({ enrollment, progress, stages });
  if (!nextResult) return [];
  const { next } = nextResult;
  const attention = stageMaterialAttention({
    asOf,
    plannedEndOn,
    currentStageId: progress.stage.id,
    nextStageId: next?.id ?? null,
    acquiredStageIds,
  });
  if (!attention) return [];
  return [
    {
      id: progress.id,
      classId: enrollment.class.id,
      className: enrollment.class.portalClassName,
      mode: enrollment.class.scheduleType,
      currentStage: progress.stage.name,
      nextStage: next?.name ?? null,
      plannedEndOn,
      ...attention,
    },
  ];
}

function materialPlannedEnd(input: {
  enrollment: Enrollment;
  progress: Progress;
  studentId: string;
}): string | null {
  const { enrollment, progress, studentId } = input;
  const ppt = enrollment.class.scheduleType === "PERSONALIZED";
  const plan = ppt ? progress.stagePlan : enrollment.class.stagePlan;
  if (!plan || plan.deletedAt || plan.stageId !== progress.stage.id) return null;
  if (ppt && progress.stagePlan?.studentId !== studentId) return null;
  return toDateOnlyString(plan.plannedEndOn);
}

function nextMaterialStage(input: {
  enrollment: Enrollment;
  progress: Progress;
  stages: Stage[];
}): { next: { id: string; name: string } | null } | null {
  const { enrollment, progress, stages } = input;
  const ppt = enrollment.class.scheduleType === "PERSONALIZED";
  const organization = enrollment.sourceSemesterPlacements[0];
  const successor = stages.find(
    (stage) => stage.trackId === progress.stage.trackId && stage.sequence > progress.stage.sequence,
  );
  const next = ppt ? successor : organization?.stage;
  if (ppt && !successor) return null;
  return { next: next ?? null };
}
