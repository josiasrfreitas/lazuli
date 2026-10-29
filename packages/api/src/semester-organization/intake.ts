import type { Prisma, TransactionClient } from "@lazuli/db";
import type { StudentPedagogyIntake } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";

const ISO_DATE_LENGTH = 10;

/** Part of student creation's transaction: the intention must not be lost between wizard steps. */
export async function recordStudentIntake(
  database: TransactionClient,
  options: {
    studentId: string;
    recordedById: string;
    input: StudentPedagogyIntake;
    now?: Date | undefined;
  },
): Promise<void> {
  const { studentId, recordedById, input, now = new Date() } = options;
  const { semester, stage, plan, today } = await intakeSelection(database, { input, now });
  if (stage)
    await createIntakePlacement(database, {
      semester,
      stage,
      plan,
      today,
      studentId,
      recordedById,
      input,
    });
}

type Period = Prisma.PeriodGetPayload<Prisma.PeriodDefaultArgs>;
type Stage = Prisma.StageGetPayload<Prisma.StageDefaultArgs>;
type ClassPlan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;

async function intakeSelection(
  database: TransactionClient,
  { input, now }: { input: StudentPedagogyIntake; now: Date },
): Promise<{ semester: Period; stage: Stage | null; plan: ClassPlan | null; today: string }> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${input.semesterId}`}, 0))`;
  const semester = await database.period.findUnique({
    where: { id: input.semesterId, deletedAt: null },
  });
  const today = saoPauloDateOnly(now);
  if (
    !semester ||
    semester.startDate.toISOString().slice(0, ISO_DATE_LENGTH) > today ||
    semester.endDate.toISOString().slice(0, ISO_DATE_LENGTH) < today
  )
    throw badRequest(
      "Cadastre como lead quem aguarda um período futuro. A entrada de aluno exige um período vigente.",
    );
  const stage = await intakeStage(database, input.stageId);
  const plan = await intakePlan(database, input);
  if (plan && !stage)
    throw badRequest("Defina o estágio para propor uma turma, ou deixe a turma para depois.");
  if (plan?.scheduleType === "REGULAR" && plan.sharedStageId !== stage?.id)
    throw badRequest("O estágio deve corresponder à turma regular escolhida.");
  return { semester, stage, plan, today };
}

async function intakeStage(
  database: TransactionClient,
  stageId: string | null,
): Promise<Stage | null> {
  if (!stageId) return null;
  const stage = await database.stage.findFirst({
    where: { id: stageId, deletedAt: null, track: { status: "ACTIVE" } },
  });
  if (!stage) throw badRequest("O estágio escolhido não está disponível.");
  return stage;
}

async function intakePlan(
  database: TransactionClient,
  input: StudentPedagogyIntake,
): Promise<ClassPlan | null> {
  if (!input.planId) return null;
  const plan = await database.semesterClassPlan.findFirst({
    where: { id: input.planId, semesterId: input.semesterId, deletedAt: null },
  });
  if (!plan) throw badRequest("A turma escolhida não está disponível neste semestre.");
  return plan;
}

async function createIntakePlacement(
  database: TransactionClient,
  {
    semester,
    stage,
    plan,
    today,
    studentId,
    recordedById,
    input,
  }: {
    semester: Period;
    stage: Stage;
    plan: ClassPlan | null;
    today: string;
    studentId: string;
    recordedById: string;
    input: StudentPedagogyIntake;
  },
): Promise<void> {
  const row = await database.semesterPlacement.create({
    data: {
      semesterId: semester.id,
      studentId,
      stageId: stage.id,
      trackId: stage.trackId,
      planId: plan?.id ?? null,
      mode: "ENTRY",
      effectiveDate: new Date(
        [today, semester.startDate.toISOString().slice(0, ISO_DATE_LENGTH)].toSorted().at(-1)!,
      ),
      notes: input.notes || null,
      recordedById,
    },
  });
  await recordIntakePlacementRevision(database, {
    placementId: row.id,
    version: row.version,
    studentId,
    stageId: stage.id,
    planId: plan?.id ?? null,
    notes: input.notes,
    recordedById,
  });
}

async function recordIntakePlacementRevision(
  database: TransactionClient,
  values: {
    placementId: string;
    version: number;
    studentId: string;
    stageId: string;
    planId: string | null;
    notes: string;
    recordedById: string;
  },
): Promise<void> {
  const { placementId, version, studentId, stageId, planId, notes, recordedById } = values;
  await database.semesterPlacementRevision.create({
    data: {
      placementId,
      version,
      action: "PROPOSED",
      recordedById,
      snapshot: {
        studentId,
        stageId,
        planId,
        mode: "ENTRY",
        notes,
      },
    },
  });
}
