import { z } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { createClass } from "../classes/data.js";
import {
  lockTeacher,
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../teachers/availability.js";
import { GENERATION_STALE_MS, requestSessionGeneration } from "../session-generation/requests.js";
import { lockCandidate } from "../admissions/candidates.js";
import { lockStudentEnrollment } from "../enrollment/data.js";
import {
  assertVersion,
  dateOnly,
  lockSemester,
  readSlots,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";

export const continuitySchema = z
  .object({
    semesterId: z.string().uuid(),
    id: z.string().uuid(),
    version: z.number().int().positive(),
    continuity: z.enum(["UNDECIDED", "STAY", "CHANGE", "LEAVING"]),
    reason: z.string().trim().max(1200).default(""),
  })
  .strict()
  .refine(
    (value) => !["CHANGE", "LEAVING"].includes(value.continuity) || value.reason.length >= 3,
    { path: ["reason"], message: "Registre o motivo para a equipe acompanhar." },
  );

export async function saveContinuity(
  context: OrganizationContext,
  input: z.infer<typeof continuitySchema>,
) {
  await lockSemester(context, input.semesterId);
  const row = await context.database.semesterPlacement.findFirst({
    where: { id: input.id, semesterId: input.semesterId, deletedAt: null },
    include: { student: { select: { fullName: true } } },
  });
  if (!row) throw notFound("Aluno não encontrado nesta organização.");
  await lockStudentEnrollment(context.database, row.studentId);
  assertVersion(row.version, input.version);
  await context.database.semesterPlacement.update({
    where: { id: row.id },
    data: {
      continuity: input.continuity,
      continuityReason: input.reason || null,
      version: { increment: 1 },
    },
  });
  await recordPlacementRevision(context, row.id, "CONTINUITY", input.reason);
  await recordActivity(context.database, context, "semesterOrganization.continuity", {
    subject: { type: "student", id: row.studentId, name: row.student.fullName },
    description: {
      UNDECIDED: "Continuidade a conversar.",
      STAY: "Intenção de continuar na turma.",
      CHANGE: "Continuará na escola; aguarda outra turma.",
      LEAVING: "Possível saída da escola; acompanhamento necessário.",
    }[input.continuity],
  });
}

export const pendingLeadSchema = z
  .object({
    id: z.string().uuid(),
    pending: z.boolean(),
    reason: z.string().trim().max(1200).default(""),
  })
  .strict()
  .refine((value) => !value.pending || value.reason.length >= 3, {
    path: ["reason"],
    message: "Informe o motivo da pendência.",
  });

export async function pendingLead(
  context: OrganizationContext,
  input: z.infer<typeof pendingLeadSchema>,
) {
  await lockCandidate(context.database, input.id);
  const lead = await context.database.admissionCandidate.findFirst({
    where: { id: input.id, deletedAt: null, status: "WAITING" },
  });
  if (!lead) throw badRequest("O lead precisa estar aberto para aguardar uma turma.");
  await context.database.admissionCandidate.update({
    where: { id: lead.id },
    data: {
      allocationPendingAt: input.pending ? context.now : null,
      allocationPendingReason: input.pending ? input.reason : null,
      ...(!input.pending ? { allocationPlanId: null } : {}),
    },
  });
  await recordActivity(context.database, context, "semesterOrganization.pendingLead", {
    subject: { type: "lead", id: lead.id, name: lead.fullName },
    description: input.pending
      ? `Aguarda turma: ${input.reason}`
      : "Pendência de alocação removida.",
  });
}

export const planLifecycleSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
    open: z.boolean(),
  })
  .strict();

export async function changePlanStatus(
  context: OrganizationContext,
  input: z.infer<typeof planLifecycleSchema>,
) {
  const initial = await context.database.semesterClassPlan.findUnique({ where: { id: input.id } });
  if (!initial) throw notFound("Turma não encontrada.");
  const semester = await lockSemester(context, initial.semesterId);
  const plan = await context.database.semesterClassPlan.findUniqueOrThrow({
    where: { id: input.id },
  });
  assertVersion(plan.version, input.version);
  await lockTeacher(context.database, plan.teacherId ?? "");
  let classId = plan.classId;
  let generationRequestId: string | null = null;
  if (input.open) {
    if (!plan.teacherId) throw badRequest("Defina o professor antes de abrir a turma.");
    const from = [saoPauloDateOnly(context.now), dateOnly(semester.startDate)].sort().at(-1)!;
    await assertTeacherEligible({
      database: context.database,
      teacherId: plan.teacherId,
      date: from,
    });
    if (!classId) {
      const created = await createClass({
        database: context.database,
        recordedById: context.staffUser.id,
        values: {
          semesterId: semester.id,
          teacherId: plan.teacherId,
          scheduleType: plan.scheduleType,
          format: plan.format,
          sharedStageId: plan.sharedStageId,
          slots: readSlots(plan.slots),
        },
      });
      classId = created.id;
    } else {
      await assertNoTeacherConflict({
        database: context.database,
        teacherId: plan.teacherId,
        from,
        through: dateOnly(semester.endDate),
        slots: readSlots(plan.slots),
        excludeClassId: classId,
      });
      await context.database.class.update({ where: { id: classId }, data: { status: "ACTIVE" } });
    }
    const preparing = await context.database.sessionGenerationRequest.findFirst({
      where: {
        classId,
        deletedAt: null,
        status: { in: ["PENDING", "QUEUED", "RUNNING"] },
        createdAt: { gt: new Date(context.now.getTime() - GENERATION_STALE_MS) },
      },
    });
    if (!preparing)
      generationRequestId = (
        await requestSessionGeneration(
          context.database,
          { classId },
          context.staffUser.id,
          context.now,
        )
      ).id;
  } else if (classId) {
    const active = await context.database.enrollment.count({
      where: {
        classId,
        deletedAt: null,
        OR: [{ exitDate: null }, { exitDate: { gt: new Date(saoPauloDateOnly(context.now)) } }],
      },
    });
    if (active)
      throw badRequest("Transfira ou encerre os vínculos dos alunos antes de encerrar a turma.");
    await context.database.class.update({ where: { id: classId }, data: { status: "ARCHIVED" } });
  }
  await context.database.semesterClassPlan.update({
    where: { id: plan.id },
    data: { classId, closedAt: input.open ? null : context.now, version: { increment: 1 } },
  });
  await recordActivity(context.database, context, "semesterOrganization.planStatus", {
    subject: { type: "school", name: plan.name },
    description: input.open ? "Turma aberta para receber alunos." : "Turma encerrada.",
  });
  return { classId, generationRequestId };
}
