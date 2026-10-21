import type {
  SemesterPlanInput,
  SemesterPlacementInput,
  StudentAvailabilityInput,
  z,
  invalidateAvailabilitySchema,
} from "@lazuli/validators";
import { classScheduleSlotsInputSchema } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { recordActivity } from "../activity/record.js";
import { lockStudentEnrollment } from "../enrollment/data.js";
import { loadActiveStage, assertTeacherIsActive } from "../classes/guards.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockCandidate } from "../admissions/candidates.js";
import {
  readSlots,
  lockSemester,
  assertVersion,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";

const ISO_DATE_LENGTH = 10;

export async function saveClassPlan(
  context: OrganizationContext,
  input: SemesterPlanInput,
): Promise<{ id: string }> {
  await lockSemester(context, input.semesterId);
  if (input.teacherId)
    await assertTeacherIsActive({ database: context.database, teacherId: input.teacherId });
  if (input.sharedStageId)
    await loadActiveStage({ database: context.database, stageId: input.sharedStageId });
  const previous = input.id
    ? await context.database.semesterClassPlan.findFirst({
        where: { id: input.id, semesterId: input.semesterId },
      })
    : null;
  if (input.id && !previous) throw notFound("Turma planejada não encontrada.");
  assertVersion(previous?.version ?? 0, input.version);
  if (previous?.classId)
    throw badRequest(
      "Esta turma já foi publicada. Use a operação da turma para alterar o professor.",
    );
  const scheduleKey = (slots: typeof input.slots): string =>
    slots
      .map((slot) => `${slot.weekday}:${slot.startTime}:${slot.endTime}`)
      .toSorted()
      .join("|");
  if (!previous || scheduleKey(readSlots(previous.slots)) !== scheduleKey(input.slots)) {
    const schedule = classScheduleSlotsInputSchema.safeParse(input.slots);
    if (!schedule.success) throw badRequest(schedule.error.issues[0]!.message);
  }
  const data = {
    name: input.name,
    scheduleType: input.scheduleType,
    format: input.format,
    teacherId: input.teacherId,
    sharedStageId: input.sharedStageId,
    slots: input.slots,
    recordedById: context.staffUser.id,
  };
  const plan = previous
    ? await context.database.semesterClassPlan.update({
        where: { id: previous.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await context.database.semesterClassPlan.create({
        data: { ...data, semesterId: input.semesterId },
      });
  for (const id of [...new Set(input.leadIds ?? [])].toSorted()) {
    await lockCandidate(context.database, id);
    const lead = await context.database.admissionCandidate.findFirst({
      where: { id, status: "WAITING", deletedAt: null, allocationPendingAt: { not: null } },
    });
    if (!lead) throw badRequest("Um dos leads já saiu da fila. Atualize a organização.");
    if (input.scheduleType === "REGULAR" && lead.stageId !== input.sharedStageId)
      throw badRequest(`${lead.fullName}: escolha uma turma do estágio indicado.`);
    if (
      (lead.scheduleType && lead.scheduleType !== input.scheduleType) ||
      (lead.format && lead.format !== input.format)
    )
      throw badRequest(
        `${lead.fullName}: a modalidade ou o formato não atende ao interesse registrado.`,
      );
    await context.database.admissionCandidate.update({
      where: { id },
      data: { allocationPlanId: plan.id },
    });
  }
  await recordActivity(context.database, context, "semesterOrganization.savePlan", {
    subject: { type: "school", name: plan.name },
    description: previous
      ? "Organização da turma revisada."
      : "Turma incluída na organização do semestre.",
  });
  return { id: plan.id };
}

export async function savePlacement(
  context: OrganizationContext,
  input: SemesterPlacementInput,
): Promise<{ id: string }> {
  const semester = await lockSemester(context, input.semesterId);
  const effectiveDate =
    input.effectiveDate ??
    [semester.startDate.toISOString().slice(0, ISO_DATE_LENGTH), saoPauloDateOnly(context.now)]
      .toSorted()
      .at(-1)!;
  if (
    effectiveDate < semester.startDate.toISOString().slice(0, ISO_DATE_LENGTH) ||
    effectiveDate > semester.endDate.toISOString().slice(0, ISO_DATE_LENGTH) ||
    effectiveDate < saoPauloDateOnly(context.now)
  )
    throw badRequest("Escolha uma vigência de hoje em diante, dentro do semestre.");
  await lockStudentEnrollment(context.database, input.studentId);
  const student = await context.database.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw notFound("Aluno não encontrado.");
  const previous = input.id
    ? await context.database.semesterPlacement.findFirst({
        where: { id: input.id, semesterId: input.semesterId, studentId: input.studentId },
      })
    : null;
  if (input.id && !previous) throw notFound("Proposta não encontrada.");
  assertVersion(previous?.version ?? 0, input.version);
  if (previous?.publishedAt) throw badRequest("Desfaça a publicação antes de revisar a proposta.");
  if (
    input.planId &&
    !(await context.database.semesterClassPlan.findFirst({
      where: { id: input.planId, semesterId: input.semesterId },
    }))
  )
    throw badRequest("Escolha uma turma deste semestre.");
  const source = input.sourceProgressId
    ? await context.database.pedagogicalProgress.findFirst({
        where: {
          id: input.sourceProgressId,
          enrollment: { studentId: input.studentId, deletedAt: null },
        },
        include: { stage: true },
      })
    : null;
  if (input.sourceProgressId && !source)
    throw badRequest("Percurso de origem não encontrado para este aluno.");
  if (input.mode !== "ENTRY" && !source) throw badRequest("Selecione o percurso de origem.");
  if (input.mode === "ENTRY" && source)
    throw badRequest("Entrada nova não deve ter um percurso de origem.");
  const stage = input.stageId
    ? await loadActiveStage({ database: context.database, stageId: input.stageId })
    : null;
  const trackId = stage?.trackId ?? source?.stage.trackId;
  if (!trackId) throw badRequest("Defina o estágio indicado para este aluno.");
  const duplicate = await context.database.semesterPlacement.findFirst({
    where: {
      semesterId: input.semesterId,
      studentId: input.studentId,
      trackId,
      ...(previous ? { id: { not: previous.id } } : {}),
    },
  });
  if (duplicate)
    throw badRequest(
      "Este aluno já tem uma proposta nesta trilha e semestre. Revise a proposta existente.",
    );
  const data = {
    semesterId: input.semesterId,
    studentId: input.studentId,
    planId: input.planId,
    stageId: input.stageId,
    trackId,
    sourceEnrollmentId: source?.enrollmentId ?? null,
    sourceProgressId: source?.id ?? null,
    mode: input.mode,
    effectiveDate: new Date(effectiveDate),
    declinedAt: null,
    declinedReason: null,
    notes: input.notes || null,
    recordedById: context.staffUser.id,
  };
  const row = previous
    ? await context.database.semesterPlacement.update({
        where: { id: previous.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await context.database.semesterPlacement.create({ data });
  await recordPlacementRevision(context, row.id, previous ? "REVISED" : "PROPOSED");
  await recordActivity(context.database, context, "semesterOrganization.savePlacement", {
    subject: { type: "student", id: student.id, name: student.fullName },
    description: "Proposta de alocação registrada.",
  });
  return { id: row.id };
}

async function availabilityOwner(
  context: OrganizationContext,
  input: { semesterId: string; studentId: string; previousId: string | null },
) {
  await lockSemester(context, input.semesterId);
  await lockStudentEnrollment(context.database, input.studentId);
  const student = await context.database.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw notFound("Aluno não encontrado.");
  const previous = await context.database.studentAvailability.findFirst({
    where: { studentId: input.studentId, semesterId: input.semesterId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if ((previous?.id ?? null) !== input.previousId)
    throw badRequest("A disponibilidade mudou. Atualize a página antes de confirmar.");
  return { student, previous };
}
export async function confirmAvailability(
  context: OrganizationContext,
  input: StudentAvailabilityInput,
): Promise<{ id: string }> {
  const { student, previous } = await availabilityOwner(context, input);
  if (input.validUntil < saoPauloDateOnly(context.now))
    throw badRequest("A validade da confirmação não pode estar no passado.");
  const row = await context.database.studentAvailability.create({
    data: {
      semesterId: input.semesterId,
      studentId: input.studentId,
      validUntil: new Date(input.validUntil),
      formats: [...new Set(input.formats)],
      slots: input.slots,
      notes: input.notes || null,
      recordedById: context.staffUser.id,
      createdAt: new Date(
        Math.max(context.now.getTime(), (previous?.createdAt.getTime() ?? 0) + 1),
      ),
    },
  });
  await recordActivity(context.database, context, "semesterOrganization.confirmAvailability", {
    subject: { type: "student", id: student.id, name: student.fullName },
    description: `Disponibilidade confirmada até ${input.validUntil.split("-").toReversed().join("/")}.`,
  });
  return { id: row.id };
}
export async function invalidateAvailability(
  context: OrganizationContext,
  input: z.infer<typeof invalidateAvailabilitySchema>,
): Promise<{ id: string }> {
  const { student, previous } = await availabilityOwner(context, input);
  if (!previous?.confirmed) throw badRequest("Esta disponibilidade já está invalidada.");
  const row = await context.database.studentAvailability.create({
    data: {
      studentId: input.studentId,
      semesterId: input.semesterId,
      confirmed: false,
      validUntil: previous.validUntil,
      formats: previous.formats,
      slots: previous.slots ?? [],
      notes: input.reason,
      recordedById: context.staffUser.id,
      createdAt: new Date(
        Math.max(context.now.getTime(), (previous?.createdAt.getTime() ?? 0) + 1),
      ),
    },
  });
  await recordActivity(context.database, context, "semesterOrganization.invalidateAvailability", {
    subject: { type: "student", id: student.id, name: student.fullName },
    description: input.reason,
  });
  return { id: row.id };
}
