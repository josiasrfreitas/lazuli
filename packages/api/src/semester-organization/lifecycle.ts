import { releaseClassPlaces, releaseEnrollments } from "./dissolve.js";
import { z } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { createClass } from "../classes/data.js";
import { resolvePortalClassName } from "../classes/portal-name.js";
import {
  lockTeacher,
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../teachers/availability.js";
import { GENERATION_STALE_MS, requestSessionGeneration } from "../session-generation/requests.js";
import type { Prisma } from "@lazuli/db";
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

const MAX_REASON_LENGTH = 1200;
const MIN_REASON_LENGTH = 3;

export const continuitySchema = z
  .object({
    semesterId: z.string().uuid(),
    id: z.string().uuid(),
    version: z.number().int().positive(),
    continuity: z.enum(["UNDECIDED", "STAY", "CHANGE", "LEAVING"]),
    attentionNote: z.string().trim().max(MAX_REASON_LENGTH).optional(),
    reason: z.string().trim().max(MAX_REASON_LENGTH).default(""),
  })
  .strict()
  .refine(
    (value) =>
      !["CHANGE", "LEAVING"].includes(value.continuity) || value.reason.length >= MIN_REASON_LENGTH,
    { path: ["reason"], message: "Registre o motivo para a equipe acompanhar." },
  );

export async function saveContinuity(
  context: OrganizationContext,
  input: z.infer<typeof continuitySchema>,
): Promise<void> {
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
      continuity: input.continuity === "STAY" ? "UNDECIDED" : input.continuity,
      continuityReason: input.reason || null,
      ...(row.continuity === "LEAVING" && input.continuity === "CHANGE"
        ? { exitRiskActive: true }
        : {}),
      ...(input.attentionNote === undefined ? {} : { attentionNote: input.attentionNote || null }),
      version: { increment: 1 },
    },
  });
  await recordPlacementRevision(context, {
    id: row.id,
    action: "CONTINUITY",
    reason: input.reason,
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.continuity",
    details: {
      subject: { type: "student", id: row.studentId, name: row.student.fullName },
      description: {
        UNDECIDED: "Sinalização de continuidade atualizada.",
        STAY: "Sinalização de continuidade atualizada.",
        CHANGE: "Continuará na escola; aguarda outra turma.",
        LEAVING: "Possível saída da escola; acompanhamento necessário.",
      }[input.continuity],
    },
  });
}

export const pendingLeadSchema = z
  .object({
    id: z.string().uuid(),
    pending: z.boolean(),
    reason: z.string().trim().max(MAX_REASON_LENGTH).default(""),
  })
  .strict()
  .refine((value) => !value.pending || value.reason.length >= MIN_REASON_LENGTH, {
    path: ["reason"],
    message: "Informe o motivo da pendência.",
  });

export async function pendingLead(
  context: OrganizationContext,
  input: z.infer<typeof pendingLeadSchema>,
): Promise<void> {
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
      ...(input.pending ? {} : { allocationPlanId: null }),
    },
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.pendingLead",
    details: {
      subject: { type: "lead", id: lead.id, name: lead.fullName },
      description: input.pending
        ? `Aguarda turma: ${input.reason}`
        : "Pendência de alocação removida.",
    },
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
): Promise<PlanStatus & { reconciliationRequestId: string | null }> {
  const initial = await context.database.semesterClassPlan.findUnique({ where: { id: input.id } });
  if (!initial) throw notFound("Turma não encontrada.");
  const semester = await lockSemester(context, initial.semesterId);
  const plan = await context.database.semesterClassPlan.findUniqueOrThrow({
    where: { id: input.id },
  });
  assertVersion(plan.version, input.version);
  await lockTeacher(context.database, plan.teacherId ?? "");
  const { classId, generationRequestId, name } = input.open
    ? await openClassPlan(context, { plan, semester })
    : await closeClassPlan(context, plan);
  await context.database.semesterClassPlan.update({
    where: { id: plan.id },
    data: { classId, name, closedAt: input.open ? null : context.now, version: { increment: 1 } },
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.planStatus",
    details: {
      subject: { type: "school", name },
      description: input.open ? "Turma aberta para receber alunos." : "Turma encerrada.",
    },
  });
  const reconciliationRequestId =
    input.open || classId === null
      ? null
      : await requestDissolutionReconciliation(context, { classId, semester });
  return { classId, generationRequestId, reconciliationRequestId };
}

/** Operational classes can exist before their semester plan is prepared. */
export async function dissolveClass(
  context: OrganizationContext,
  id: string,
): Promise<{ reconciliationRequestId: string | null }> {
  const { semesterId } = await context.database.class.findUniqueOrThrow({
    where: { id },
    select: { semesterId: true },
  });
  const semester = await lockSemester(context, semesterId);
  const classroom = await context.database.class.findUniqueOrThrow({
    where: { id, semesterId },
    select: {
      status: true,
      teacherId: true,
      portalClassName: true,
      semesterPlan: { select: { id: true, version: true, deletedAt: true } },
    },
  });
  if (classroom.status === "ARCHIVED") throw badRequest("A turma já está encerrada.");
  const plan = classroom.semesterPlan;
  if (plan && !plan.deletedAt)
    return changePlanStatus(context, { id: plan.id, version: plan.version, open: false });
  await lockTeacher(context.database, classroom.teacherId);
  await releaseEnrollments(context, {
    classId: id,
    semesterId,
    today: new Date(saoPauloDateOnly(context.now)),
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.planStatus",
    details: {
      subject: { type: "school", name: classroom.portalClassName },
      description: "Turma encerrada.",
    },
  });
  return {
    reconciliationRequestId: await requestDissolutionReconciliation(context, {
      classId: id,
      semester,
    }),
  };
}

type ClassPlan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
type Period = Prisma.PeriodGetPayload<Prisma.PeriodDefaultArgs>;
type PlanStatus = { classId: string | null; generationRequestId: string | null };
type LinkedClass = { id: string; portalClassName: string };

async function requestDissolutionReconciliation(
  context: OrganizationContext,
  { classId, semester }: { classId: string; semester: Period },
): Promise<string> {
  const fromDate = new Date(saoPauloDateOnly(context.now));
  // Explicit collective extras can be later than the academic period.
  const lastExtra = await context.database.classSession.findFirst({
    where: {
      classId,
      date: { gte: fromDate, gt: semester.endDate },
      deletedAt: null,
      status: "SCHEDULED",
      appointmentSeriesId: { not: null },
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const request = await context.database.calendarReconciliationRequest.create({
    data: {
      semesterId: semester.id,
      fromDate,
      throughDate: lastExtra?.date ?? (semester.endDate >= fromDate ? semester.endDate : fromDate),
      reason: "Turma desfeita.",
      requestedById: context.staffUser.id,
    },
    select: { id: true },
  });
  return request.id;
}

async function openClassPlan(
  context: OrganizationContext,
  { plan, semester }: { plan: ClassPlan; semester: Period },
): Promise<PlanStatus & { name: string }> {
  if (!plan.teacherId) throw badRequest("Defina o docente antes de abrir a turma.");
  const from = [
    saoPauloDateOnly(context.now),
    dateOnly(semester.startDate),
    dateOnly(plan.startsOn ?? semester.startDate),
  ]
    .toSorted()
    .at(-1)!;
  await assertTeacherEligible({
    database: context.database,
    teacherId: plan.teacherId,
    date: from,
  });
  const classroom = plan.classId
    ? await reopenClassPlan(context, {
        plan,
        semester,
        from,
        classId: plan.classId,
        teacherId: plan.teacherId,
      })
    : await createClassPlan(context, {
        plan,
        semester,
        teacherId: plan.teacherId,
        startDate: from,
      });
  const classId = classroom.id;
  const preparing = await context.database.sessionGenerationRequest.findFirst({
    where: {
      classId,
      deletedAt: null,
      status: { in: ["PENDING", "QUEUED", "RUNNING"] },
      createdAt: { gt: new Date(context.now.getTime() - GENERATION_STALE_MS) },
    },
  });
  const generation = preparing
    ? null
    : await requestSessionGeneration(context.database, {
        scope: { classId },
        requestedById: context.staffUser.id,
        now: context.now,
      });
  return { classId, name: classroom.portalClassName, generationRequestId: generation?.id ?? null };
}

async function reopenClassPlan(
  context: OrganizationContext,
  {
    plan,
    semester,
    from,
    classId,
    teacherId,
  }: {
    plan: ClassPlan;
    semester: Period;
    from: string;
    classId: string;
    teacherId: string;
  },
): Promise<LinkedClass> {
  const slots = readSlots(plan.slots);
  await assertNoTeacherConflict({
    database: context.database,
    teacherId,
    from,
    through: dateOnly(semester.endDate),
    slots,
    excludeClassId: classId,
  });
  const current = await context.database.class.findUniqueOrThrow({
    where: { id: classId },
    select: { id: true, status: true, portalClassName: true },
  });
  if (current.status === "ACTIVE") return current;
  const collision = await context.database.class.findFirst({
    where: { portalClassName: current.portalClassName, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (collision && slots.length === 0)
    throw badRequest("O nome desta turma já está em uso. Defina os horários antes de reabri-la.");
  const portalClassName = collision
    ? await resolvePortalClassName(context.database, {
        scheduleType: plan.scheduleType,
        sharedStageId: plan.sharedStageId,
        teacherId,
        slots,
      })
    : current.portalClassName;
  return context.database.class.update({
    where: { id: classId },
    data: { status: "ACTIVE", portalClassName },
    select: { id: true, portalClassName: true },
  });
}

async function createClassPlan(
  context: OrganizationContext,
  {
    plan,
    semester,
    teacherId,
    startDate,
  }: { plan: ClassPlan; semester: Period; teacherId: string; startDate: string },
): Promise<LinkedClass> {
  return createClass({
    database: context.database,
    recordedById: context.staffUser.id,
    values: {
      semesterId: semester.id,
      ...(plan.sourceClassId ? { previousClassId: plan.sourceClassId } : {}),
      startDate,
      teacherId,
      scheduleType: plan.scheduleType,
      format: plan.format,
      sharedStageId: plan.sharedStageId,
      slots: readSlots(plan.slots),
    },
  });
}

async function closeClassPlan(
  context: OrganizationContext,
  plan: ClassPlan,
): Promise<PlanStatus & { name: string }> {
  await releaseClassPlaces(context, plan);
  return { classId: plan.classId, name: plan.name, generationRequestId: null };
}
