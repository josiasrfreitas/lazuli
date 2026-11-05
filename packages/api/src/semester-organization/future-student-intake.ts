import type { Period, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";

/** A pending intake belongs to the first configured period after today. */
export async function lockNextIntakeSemester(
  database: TransactionClient,
  now: Date,
): Promise<Period> {
  const today = new Date(saoPauloDateOnly(now));
  const semester = await database.period.findFirst({
    where: { deletedAt: null, startDate: { gt: today } },
    orderBy: { startDate: "asc" },
  });
  if (!semester) throw badRequest("Cadastre o próximo período antes de deixar a entrada pendente.");
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semester.id}`}, 0))`;
  return semester;
}

export async function recordFutureStudentIntake(
  database: TransactionClient,
  input: {
    semester: Period;
    studentId: string;
    stageId: string | null;
    planId: string | null;
    recordedById: string;
  },
): Promise<void> {
  const { semester, studentId, stageId, planId, recordedById } = input;
  const stage = stageId
    ? await database.stage.findFirst({
        where: { id: stageId, deletedAt: null, track: { status: "ACTIVE" } },
      })
    : null;
  if (stageId && !stage) throw badRequest("O estágio escolhido não está disponível.");
  const plan = planId
    ? await database.semesterClassPlan.findFirst({
        where: { id: planId, semesterId: semester.id, deletedAt: null, closedAt: null },
      })
    : null;
  if (planId && !plan)
    throw badRequest("A turma escolhida não está disponível no próximo período.");
  if (plan?.scheduleType === "REGULAR" && stage && plan.sharedStageId !== stage.id)
    throw badRequest("O estágio deve corresponder à turma regular escolhida.");

  const existing = await database.semesterPlacement.findFirst({
    where: { semesterId: semester.id, studentId, mode: "ENTRY", deletedAt: null, declinedAt: null },
  });
  const data = {
    trackId: stage?.trackId ?? null,
    stageId: stage?.id ?? null,
    planId: plan?.id ?? null,
    effectiveDate: semester.startDate,
  };
  if (
    existing?.trackId === data.trackId &&
    existing.stageId === data.stageId &&
    existing.planId === data.planId &&
    existing.effectiveDate?.getTime() === data.effectiveDate.getTime()
  )
    return;
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
      snapshot: { studentId, stageId: stage?.id ?? null, planId: plan?.id ?? null, mode: "ENTRY" },
    },
  });
}

/** Switching intake periods removes the unfinished intention for the other period. */
export async function clearOtherStudentIntake(
  database: TransactionClient,
  input: {
    studentId: string;
    entryPeriod: "CURRENT" | "NEXT";
    recordedById: string;
    now: Date;
  },
): Promise<void> {
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
