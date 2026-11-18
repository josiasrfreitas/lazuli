import type { Period, Prisma, Stage } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";

/** A pending intake belongs to the first configured period after today. */
export async function lockNextIntakeSemester(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<Period | null> {
  await lockIntakeCalendar(database);
  const today = new Date(saoPauloDateOnly(now));
  const semester = await database.period.findFirst({
    where: { deletedAt: null, startDate: { gt: today } },
    orderBy: { startDate: "asc" },
  });
  if (!semester) return null;
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semester.id}`}, 0))`;
  return semester;
}

type FutureIntakeInput = {
  semester: Period;
  studentId: string;
  stageId: string | null;
  planId: string | null;
  recordedById: string;
};
type FuturePlan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
type PlacementData = {
  trackId: string | null;
  stageId: string | null;
  planId: string | null;
  effectiveDate: Date;
};

export async function recordFutureStudentIntake(
  database: Prisma.TransactionClient,
  input: Omit<FutureIntakeInput, "semester"> & { semester: Period | null; now: Date },
): Promise<void> {
  if (!input.semester) {
    if (input.planId)
      throw badRequest("Defina o próximo período no calendário antes de escolher a turma.");
    const stage = await selectedStage(database, input.stageId);
    const data = {
      stageId: stage?.id ?? null,
      requestedOn: new Date(saoPauloDateOnly(input.now)),
      recordedById: input.recordedById,
    };
    await database.undatedStudentIntake.upsert({
      where: { studentId: input.studentId },
      create: { ...data, studentId: input.studentId },
      update: data,
    });
    return;
  }
  return recordDatedIntake(database, { ...input, semester: input.semester });
}

async function recordDatedIntake(
  database: Prisma.TransactionClient,
  input: FutureIntakeInput,
): Promise<void> {
  const stage = await selectedStage(database, input.stageId);
  const plan = await selectedPlan(database, input);
  assertStageMatchesPlan(stage, plan);
  await upsertFuturePlacement(database, {
    ...input,
    data: {
      trackId: stage?.trackId ?? null,
      stageId: stage?.id ?? null,
      planId: plan?.id ?? null,
      effectiveDate:
        plan?.startsOn && plan.startsOn > input.semester.startDate
          ? plan.startsOn
          : input.semester.startDate,
    },
  });
}

function assertStageMatchesPlan(stage: Stage | null, plan: FuturePlan | null): void {
  if (plan?.scheduleType === "REGULAR" && stage && plan.sharedStageId !== stage.id)
    throw badRequest("O estágio deve corresponder à turma regular escolhida.");
}

async function selectedStage(
  database: Prisma.TransactionClient,
  stageId: string | null,
): Promise<Stage | null> {
  if (!stageId) return null;
  const stage = await database.stage.findFirst({
    where: { id: stageId, deletedAt: null, track: { status: "ACTIVE" } },
  });
  if (!stage) throw badRequest("O estágio escolhido não está disponível.");
  return stage;
}

async function selectedPlan(
  database: Prisma.TransactionClient,
  input: FutureIntakeInput,
): Promise<FuturePlan | null> {
  if (!input.planId) return null;
  const plan = await database.semesterClassPlan.findFirst({
    where: {
      id: input.planId,
      semesterId: input.semester.id,
      deletedAt: null,
      closedAt: null,
    },
  });
  if (!plan) throw badRequest("A turma escolhida não está disponível no próximo período.");
  return plan;
}

function samePlacement(
  existing: {
    trackId: string | null;
    stageId: string | null;
    planId: string | null;
    effectiveDate: Date | null;
  } | null,
  data: PlacementData,
): boolean {
  return Boolean(
    existing?.trackId === data.trackId &&
    existing.stageId === data.stageId &&
    existing.planId === data.planId &&
    existing.effectiveDate?.getTime() === data.effectiveDate.getTime(),
  );
}

async function upsertFuturePlacement(
  database: Prisma.TransactionClient,
  input: FutureIntakeInput & { data: PlacementData },
): Promise<void> {
  const { semester, studentId, recordedById, data } = input;
  const existing = await database.semesterPlacement.findFirst({
    where: { semesterId: semester.id, studentId, mode: "ENTRY", deletedAt: null, declinedAt: null },
  });
  if (samePlacement(existing, data)) return;
  if (existing?.publishedAt)
    throw badRequest(
      "A turma do próximo período já foi confirmada. Revise a organização para alterá-la.",
    );
  const placement = existing
    ? await database.semesterPlacement.update({
        where: { id: existing.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await database.semesterPlacement.create({
        data: { ...data, semesterId: semester.id, studentId, mode: "ENTRY", recordedById },
      });
  await database.semesterPlacementRevision.create({
    data: {
      placementId: placement.id,
      version: placement.version,
      action: "PROPOSED",
      recordedById,
      snapshot: { studentId, stageId: data.stageId, planId: data.planId, mode: "ENTRY" },
    },
  });
}

/** Switching intake periods removes the unfinished intention for the other period. */
export async function clearOtherStudentIntake(
  database: Prisma.TransactionClient,
  input: {
    studentId: string;
    entryPeriod: "CURRENT" | "NEXT";
    recordedById: string;
    now: Date;
  },
): Promise<void> {
  if (input.entryPeriod === "CURRENT")
    await database.undatedStudentIntake.deleteMany({ where: { studentId: input.studentId } });
  const today = new Date(saoPauloDateOnly(input.now));
  const placements = await database.semesterPlacement.findMany({
    where: {
      studentId: input.studentId,
      deletedAt: null,
      declinedAt: null,
      mode: "ENTRY",
      enrollmentId: null,
      semester: {
        deletedAt: null,
        ...(input.entryPeriod === "CURRENT"
          ? { startDate: { gt: today } }
          : { startDate: { lte: today }, endDate: { gte: today } }),
      },
    },
  });
  if (placements.some((placement) => placement.publishedAt))
    throw badRequest(
      "A turma do outro período já foi confirmada. Revise a organização antes de mudar a entrada.",
    );
  for (const placement of placements) {
    const removed = await database.semesterPlacement.update({
      where: { id: placement.id },
      data: { deletedAt: input.now, version: { increment: 1 } },
    });
    await database.semesterPlacementRevision.create({
      data: {
        placementId: removed.id,
        version: removed.version,
        action: "INTAKE_PERIOD_CHANGED",
        recordedById: input.recordedById,
        snapshot: { studentId: input.studentId, entryPeriod: input.entryPeriod },
      },
    });
  }
}

export async function lockIntakeCalendar(database: Prisma.TransactionClient): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('formation:undated-intake', 0))`;
}

/** Calendar creation and intake share a lock, so a request cannot miss a just-created period. */
export async function bindUndatedIntakes(
  database: Prisma.TransactionClient,
  period: Period,
): Promise<void> {
  const waiting = await database.undatedStudentIntake.findMany({
    where: {
      requestedOn: { lt: period.startDate },
      student: { deletedAt: null, status: "ACTIVE" },
    },
    include: { stage: { select: { deletedAt: true, track: { select: { status: true } } } } },
    orderBy: { studentId: "asc" },
  });
  for (const item of waiting) {
    await recordDatedIntake(database, {
      semester: period,
      studentId: item.studentId,
      stageId:
        item.stage && !item.stage.deletedAt && item.stage.track.status === "ACTIVE"
          ? item.stageId
          : null,
      recordedById: item.recordedById,
      planId: null,
    });
    await database.undatedStudentIntake.delete({ where: { studentId: item.studentId } });
  }
}
