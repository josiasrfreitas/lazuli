import type { TransactionClient } from "@lazuli/db";
import type { StudentPedagogyIntake } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";

const ISO_DATE_LENGTH = 10;

/** Part of student creation's transaction: the intention must not be lost between wizard steps. */
export async function recordStudentIntake(
  database: TransactionClient,
  studentId: string,
  recordedById: string,
  input: StudentPedagogyIntake,
  now = new Date(),
): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${input.semesterId}`}, 0))`;
  const semester = await database.semester.findUnique({
    where: { id: input.semesterId, deletedAt: null },
  });
  const today = saoPauloDateOnly(now);
  if (!semester || semester.endDate.toISOString().slice(0, ISO_DATE_LENGTH) < today)
    throw badRequest("Escolha um semestre atual ou futuro para o aluno.");
  const stage = input.stageId
    ? await database.stage.findFirst({
        where: { id: input.stageId, deletedAt: null, track: { status: "ACTIVE" } },
      })
    : null;
  if (input.stageId && !stage) throw badRequest("O estágio escolhido não está disponível.");
  const plan = input.planId
    ? await database.semesterClassPlan.findFirst({
        where: { id: input.planId, semesterId: input.semesterId, deletedAt: null },
      })
    : null;
  if (input.planId && !plan)
    throw badRequest("A turma escolhida não está disponível neste semestre.");
  if (plan && !stage)
    throw badRequest("Defina o estágio para propor uma turma, ou deixe a turma para depois.");
  if (plan?.scheduleType === "REGULAR" && plan.sharedStageId !== stage?.id)
    throw badRequest("O estágio deve corresponder à turma regular escolhida.");
  await database.studentAvailability.create({
    data: {
      semesterId: semester.id,
      studentId,
      validUntil: semester.endDate,
      formats: input.formats,
      slots: input.slots,
      confirmed: input.slots.length > 0,
      notes: input.notes || null,
      recordedById,
    },
  });
  if (stage) {
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
    await database.semesterPlacementRevision.create({
      data: {
        placementId: row.id,
        version: row.version,
        action: "PROPOSED",
        recordedById,
        snapshot: {
          studentId,
          stageId: stage.id,
          planId: plan?.id ?? null,
          mode: "ENTRY",
          notes: input.notes,
        },
      },
    });
  }
}
