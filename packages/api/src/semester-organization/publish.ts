import type { PublishSemesterInput, z, withdrawSemesterSchema } from "@lazuli/validators";
import type { Prisma, Period } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { createClass } from "../classes/data.js";
import {
  lockStudentEnrollment,
  openEnrollmentAtStage,
  closeActiveEnrollment,
} from "../enrollment/data.js";
import { cancelScheduledAction } from "../enrollment/scheduled.js";
import {
  lockTeacher,
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../teachers/availability.js";
import { requestSessionGeneration } from "../session-generation/requests.js";
import { recordActivity } from "../activity/record.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockCandidate, readCandidate } from "../admissions/candidates.js";
import { assertPlacementReady } from "../admissions/placement.js";
import { requireLeadGuardian } from "../admissions/guardian.js";
import {
  lockSemester,
  assertVersion,
  recordPlacementRevision,
  dateOnly,
  type OrganizationContext,
} from "./data.js";
import { readSemester, type PlacementRow } from "./queries.js";

type Plan = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
type Lead = Prisma.AdmissionCandidateGetPayload<Prisma.AdmissionCandidateDefaultArgs>;
type CurrentPlan = Awaited<ReturnType<typeof readSemester>>["plans"][number];
type BoardPlacement = Awaited<ReturnType<typeof readSemester>>["placements"][number];
const PLAN_NOT_FOUND = "Turma planejada não encontrada.";
const PLACEMENT_NOT_FOUND = "Proposta não encontrada.";
const TEACHER_REQUIRED = "Defina um professor em atuação na data de entrada.";

export async function publishPlacements(
  context: OrganizationContext,
  input: PublishSemesterInput,
): Promise<{ classId: string; count: number; generationRequestId: string | null }> {
  const plan = await context.database.semesterClassPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw notFound(PLAN_NOT_FOUND);
  const semester = await lockSemester(context, plan.semesterId);
  await lockTeacher(context.database, plan.teacherId ?? "");
  const leads = await lockPublicationTargets(context, { plan, semester, input });
  const board = await readSemester(context, semester.id);
  const { current, selected } = selectPublication(context, { board, plan, semester, input });
  await assertPublicationLeads(context, { leads, selected });
  await assertPublicationTeacher(context, { current, selected, semester });
  const { classId, generationRequestId } = await publicationClass(context, {
    current,
    plan,
    semester,
    selected,
  });
  for (const row of selected) {
    if (!row.stageId) throw badRequest("Confirme o estágio.");
    await publishOne(context, {
      row,
      classId,
      entryDate: row.effectiveDate ? new Date(row.effectiveDate) : semester.startDate,
    });
  }
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.publish",
    details: {
      subject: { type: "class", id: classId, name: current.name },
      description: `${selected.length} aluno(s) com entrada programada em ${dateOnly(semester.startDate).split("-").toReversed().join("/")}.`,
    },
  });
  return { classId, count: selected.length, generationRequestId };
}

async function lockPublicationTargets(
  context: OrganizationContext,
  { plan, semester, input }: { plan: Plan; semester: Period; input: PublishSemesterInput },
): Promise<Lead[]> {
  const targets = await context.database.semesterPlacement.findMany({
    where: {
      id: { in: input.placements.map((row) => row.id) },
      planId: plan.id,
      semesterId: semester.id,
    },
    select: { studentId: true },
  });
  if (targets.length !== input.placements.length)
    throw badRequest("Selecione propostas desta turma.");
  const leads = await context.database.admissionCandidate.findMany({
    where: {
      studentId: { in: targets.map((row) => row.studentId) },
      status: "WAITING",
      deletedAt: null,
    },
    orderBy: { id: "asc" },
  });
  for (const lead of leads) await lockCandidate(context.database, lead.id);
  for (const studentId of [...new Set(targets.map((row) => row.studentId))].toSorted())
    await lockStudentEnrollment(context.database, studentId);
  return leads;
}

function selectPublication(
  context: OrganizationContext,
  {
    board,
    plan,
    semester,
    input,
  }: {
    board: Awaited<ReturnType<typeof readSemester>>;
    plan: Plan;
    semester: Period;
    input: PublishSemesterInput;
  },
): { current: CurrentPlan; selected: BoardPlacement[] } {
  const current = board.plans.find((row) => row.id === plan.id);
  if (!current) throw notFound(PLAN_NOT_FOUND);
  assertVersion(current.version, input.version);
  if (!current.teacherId || !current.teacherReady) throw badRequest(TEACHER_REQUIRED);
  const selected = input.placements.map((item) =>
    selectedPlacement(context, { board, plan, semester, item }),
  );
  return { current, selected };
}

function selectedPlacement(
  context: OrganizationContext,
  {
    board,
    plan,
    semester,
    item,
  }: {
    board: Awaited<ReturnType<typeof readSemester>>;
    plan: Plan;
    semester: Period;
    item: PublishSemesterInput["placements"][number];
  },
): BoardPlacement {
  const row = board.placements.find(
    (candidate) => candidate.id === item.id && candidate.planId === plan.id,
  );
  if (!row) throw notFound(PLACEMENT_NOT_FOUND);
  assertVersion(row.version, item.version);
  if (row.declinedAt) throw badRequest("O aluno não continuará neste semestre.");
  if (row.continuity === "LEAVING")
    throw badRequest(`${row.studentName}: converse sobre a possível saída antes de confirmar.`);
  if (dateOnly(row.effectiveDate ?? semester.startDate) < saoPauloDateOnly(context.now))
    throw badRequest("Revise a vigência: a data proposta já passou.");
  if (row.publishedAt) throw badRequest("Um dos alunos já foi publicado. Atualize a página.");
  if (row.blockers.length > 0) throw badRequest(`${row.studentName}: ${row.blockers.join("; ")}.`);
  return row;
}

async function assertPublicationLeads(
  context: OrganizationContext,
  { leads, selected }: { leads: Lead[]; selected: BoardPlacement[] },
): Promise<void> {
  for (const lead of leads) {
    const candidate = await readCandidate(context.database, lead.id);
    const row = selected.find((item) => item.studentId === candidate.studentId);
    if (!row) continue;
    if (
      !candidate.stageId ||
      candidate.stageId !== row.stageId ||
      candidate.englishExperience === "UNKNOWN"
    )
      throw badRequest(
        `${candidate.fullName}: confirme a experiência e o estágio no cadastro do lead.`,
      );
    if (candidate.englishExperience === "SOME")
      await assertPlacementReady(context.database, candidate);
    await requireLeadGuardian(context.database, {
      candidate,
      student: { mode: "existing", id: row.studentId },
    });
  }
}

async function assertPublicationTeacher(
  context: OrganizationContext,
  {
    current,
    selected,
    semester,
  }: { current: CurrentPlan; selected: BoardPlacement[]; semester: Period },
): Promise<void> {
  if (!current.teacherId) throw badRequest(TEACHER_REQUIRED);
  for (const row of selected)
    await assertTeacherEligible({
      database: context.database,
      teacherId: current.teacherId,
      date: dateOnly(row.effectiveDate ?? semester.startDate),
    });
  await assertNoTeacherConflict({
    database: context.database,
    teacherId: current.teacherId,
    from: selected.map((row) => dateOnly(row.effectiveDate ?? semester.startDate)).toSorted()[0]!,
    through: dateOnly(semester.endDate),
    slots: current.slots,
    ...(current.classId ? { excludeClassId: current.classId } : {}),
  });
}

async function publicationClass(
  context: OrganizationContext,
  {
    current,
    plan,
    semester,
    selected,
  }: { current: CurrentPlan; plan: Plan; semester: Period; selected: BoardPlacement[] },
): Promise<{ classId: string; generationRequestId: string | null }> {
  if (!current.teacherId) throw badRequest(TEACHER_REQUIRED);
  const firstEntryDate = selected
    .map((row) => dateOnly(row.effectiveDate ?? semester.startDate))
    .toSorted()[0]!;
  const existingClass = current.classId
    ? await context.database.class.findUniqueOrThrow({
        where: { id: current.classId },
        select: { id: true, startDate: true },
      })
    : null;
  const classRow =
    existingClass ??
    (await createClass({
      database: context.database,
      recordedById: context.staffUser.id,
      values: {
        teacherId: current.teacherId,
        scheduleType: current.scheduleType,
        format: current.format,
        sharedStageId: current.sharedStageId,
        semesterId: semester.id,
        startDate: firstEntryDate,
        slots: current.slots,
      },
    }));
  const earlierEntry =
    existingClass !== null &&
    firstEntryDate < dateOnly(existingClass.startDate ?? semester.startDate);
  if (earlierEntry)
    await context.database.class.update({
      where: { id: classRow.id },
      data: { startDate: new Date(firstEntryDate) },
    });
  let generationRequestId: string | null = null;
  if (!current.classId) {
    await context.database.semesterClassPlan.update({
      where: { id: plan.id },
      data: { classId: classRow.id, version: { increment: 1 } },
    });
  }
  if (!current.classId || earlierEntry) {
    const generation = await requestSessionGeneration(context.database, {
      scope: { classId: classRow.id },
      requestedById: context.staffUser.id,
      now: context.now,
    });
    generationRequestId = generation.id;
  }
  return { classId: classRow.id, generationRequestId };
}
async function publishOne(
  context: OrganizationContext,
  options: {
    row: PlacementRow;
    classId: string;
    entryDate: Date;
  },
): Promise<void> {
  const { row, classId, entryDate } = options;

  const immediate = dateOnly(entryDate) <= saoPauloDateOnly(context.now);
  if (row.sourceClassId === classId && row.mode === "CONTINUE") {
    await confirmContinuity(context, row);
    return;
  }
  const sourceExitActionId = await scheduleSourceExit(context, { row, entryDate, immediate });
  const { enrollmentId, entryActionId } = await openPublishedStudent(context, {
    row,
    classId,
    entryDate,
    immediate,
  });
  await markPlacementPublished(context, {
    row,
    enrollmentId,
    entryActionId,
    sourceExitActionId,
  });
  await context.database.admissionCandidate.updateMany({
    where: { studentId: row.studentId, status: "WAITING", deletedAt: null },
    data: {
      status: "ENROLLED",
      enrollmentId,
      allocationPendingAt: null,
      allocationPendingReason: null,
    },
  });
  await recordPlacementRevision(context, { id: row.id, action: "PUBLISHED" });
}

async function markPlacementPublished(
  context: OrganizationContext,
  {
    row,
    enrollmentId,
    entryActionId,
    sourceExitActionId,
  }: {
    row: PlacementRow;
    enrollmentId: string | null;
    entryActionId: string | null;
    sourceExitActionId: string | null;
  },
): Promise<void> {
  await context.database.semesterPlacement.update({
    where: { id: row.id },
    data: {
      publishedAt: context.now,
      publishedById: context.staffUser.id,
      enrollmentId,
      continuity: "STAY",
      continuityReason: null,
      entryActionId,
      sourceExitActionId,
      version: { increment: 1 },
      publishedEvidence: {
        sourceProgressId: row.sourceProgressId,
        assessmentId: row.assessmentId,
        stagePlanId: row.stagePlanId,
        assessmentVersion: row.assessmentVersion,
      },
    },
  });
}

async function confirmContinuity(context: OrganizationContext, row: PlacementRow): Promise<void> {
  await context.database.semesterPlacement.update({
    where: { id: row.id },
    data: {
      publishedAt: context.now,
      publishedById: context.staffUser.id,
      enrollmentId: row.sourceEnrollmentId,
      continuity: "STAY",
      version: { increment: 1 },
    },
  });
  await recordPlacementRevision(context, { id: row.id, action: "CONFIRMED_CONTINUITY" });
}

async function scheduleSourceExit(
  context: OrganizationContext,
  { row, entryDate, immediate }: { row: PlacementRow; entryDate: Date; immediate: boolean },
): Promise<string | null> {
  if (!row.sourceEnrollmentId) return null;
  const pending = await context.database.enrollmentAction.count({
    where: {
      enrollmentId: row.sourceEnrollmentId,
      status: "SCHEDULED",
      kind: { in: ["PAUSE", "EXIT"] },
    },
  });
  if (pending)
    throw badRequest(
      `${row.studentName} já possui uma pausa ou saída programada. Revise essa movimentação antes de publicar.`,
    );
  const sourceExitAction = await context.database.enrollmentAction.create({
    data: {
      enrollmentId: row.sourceEnrollmentId,
      kind: "EXIT",
      status: immediate ? "APPLIED" : "SCHEDULED",
      effectiveDate: entryDate,
      exitReason: "TRANSFERRED",
      recordedById: context.staffUser.id,
      justification: "Organização de turmas",
    },
  });
  if (immediate)
    await closeActiveEnrollment({
      database: context.database,
      enrollmentId: row.sourceEnrollmentId,
      effectiveDate: entryDate,
      reason: "TRANSFERRED",
    });
  return sourceExitAction.id;
}

async function openPublishedStudent(
  context: OrganizationContext,
  {
    row,
    classId,
    entryDate,
    immediate,
  }: {
    row: PlacementRow;
    classId: string;
    entryDate: Date;
    immediate: boolean;
  },
): Promise<{ enrollmentId: string; entryActionId: string }> {
  const created = await openEnrollmentAtStage({
    database: context.database,
    studentId: row.studentId,
    classId,
    entryDate,
    stageId: row.stageId!,
    capacityOverrideReason: undefined,
    ...(row.mode === "CONTINUE"
      ? { assessmentId: row.assessmentId, stagePlanId: row.stagePlanId }
      : {}),
  });
  const entry = await context.database.enrollmentAction.create({
    data: {
      enrollmentId: created.enrollment.id,
      kind: "ENTRY",
      status: immediate ? "APPLIED" : "SCHEDULED",
      effectiveDate: entryDate,
      recordedById: context.staffUser.id,
      ...(row.sourceEnrollmentId ? { sourceEnrollmentId: row.sourceEnrollmentId } : {}),
    },
  });
  return { enrollmentId: created.enrollment.id, entryActionId: entry.id };
}
export async function withdrawPlacement(
  context: OrganizationContext,
  input: z.infer<typeof withdrawSemesterSchema>,
): Promise<{ id: string }> {
  const placement = await context.database.semesterPlacement.findUnique({
    where: { id: input.id },
  });
  if (!placement) throw notFound(PLACEMENT_NOT_FOUND);
  await lockSemester(context, placement.semesterId);
  await lockStudentEnrollment(context.database, placement.studentId);
  const current = await context.database.semesterPlacement.findUniqueOrThrow({
    where: { id: input.id },
  });
  assertVersion(current.version, input.version);
  if (!current.publishedAt || !current.entryActionId)
    throw badRequest("Esta proposta não está publicada.");
  await cancelPublicationActions(context, current);
  await reopenPublicationLead(context, { current, reason: input.reason });
  // Revision retains the published links; the proposal can then be edited and published again.
  await context.database.semesterPlacement.update({
    where: { id: current.id },
    data: { version: { increment: 1 } },
  });
  await recordPlacementRevision(context, {
    id: current.id,
    action: "WITHDRAWN",
    reason: input.reason,
  });
  await context.database.semesterPlacement.update({
    where: { id: current.id },
    data: {
      publishedAt: null,
      publishedById: null,
      enrollmentId: null,
      entryActionId: null,
      sourceExitActionId: null,
    },
  });
  await recordWithdrawalActivity(context, { studentId: current.studentId, reason: input.reason });
  return { id: current.id };
}

async function recordWithdrawalActivity(
  context: OrganizationContext,
  { studentId, reason }: { studentId: string; reason: string },
): Promise<void> {
  const student = await context.database.student.findUniqueOrThrow({ where: { id: studentId } });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.withdraw",
    details: {
      subject: { type: "student", id: student.id, name: student.fullName },
      description: reason,
    },
  });
}

type Placement = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;

async function cancelPublicationActions(
  context: OrganizationContext,
  current: Placement,
): Promise<void> {
  if (!current.entryActionId) throw badRequest("Esta proposta não está publicada.");
  await cancelScheduledAction({
    database: context.database,
    actionId: current.entryActionId,
    staffUserId: context.staffUser.id,
    now: context.now,
    semesterPlacementId: current.id,
  });
  if (current.sourceExitActionId)
    await cancelScheduledAction({
      database: context.database,
      actionId: current.sourceExitActionId,
      staffUserId: context.staffUser.id,
      now: context.now,
      semesterPlacementId: current.id,
    });
}

async function reopenPublicationLead(
  context: OrganizationContext,
  { current, reason }: { current: Placement; reason: string },
): Promise<void> {
  if (current.enrollmentId)
    await context.database.admissionCandidate.updateMany({
      where: { enrollmentId: current.enrollmentId, status: "ENROLLED", deletedAt: null },
      data: {
        status: "WAITING",
        enrollmentId: null,
        allocationPendingAt: context.now,
        allocationPendingReason: reason,
        allocationPlanId: current.planId,
      },
    });
}
