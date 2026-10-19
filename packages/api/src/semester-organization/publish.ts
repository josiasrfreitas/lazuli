import type { PublishSemesterInput, z, withdrawSemesterSchema } from "@lazuli/validators";
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
import {
  lockSemester,
  assertVersion,
  recordPlacementRevision,
  dateOnly,
  type OrganizationContext,
} from "./data.js";
import { readSemester, type PlacementRow, type CurrentAvailability } from "./queries.js";

export async function publishPlacements(context: OrganizationContext, input: PublishSemesterInput) {
  const plan = await context.database.semesterClassPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw notFound("Turma planejada não encontrada.");
  const semester = await lockSemester(context, plan.semesterId);
  await lockTeacher(context.database, plan.teacherId ?? "");
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
  for (const studentId of [...new Set(targets.map((row) => row.studentId))].toSorted())
    await lockStudentEnrollment(context.database, studentId);
  const board = await readSemester(context, semester.id);
  const current = board.plans.find((row) => row.id === plan.id);
  if (!current) throw notFound("Turma planejada não encontrada.");
  assertVersion(current.version, input.version);
  if (!current.teacherId || !current.teacherReady)
    throw badRequest("Defina um professor em atuação na data de entrada.");
  const selected = input.placements.map((item) => {
    const row = board.placements.find(
      (candidate) => candidate.id === item.id && candidate.planId === plan.id,
    );
    if (!row) throw notFound("Proposta não encontrada.");
    assertVersion(row.version, item.version);
    if (row.declinedAt) throw badRequest("O aluno não continuará neste semestre.");
    if (dateOnly(row.effectiveDate ?? semester.startDate) < saoPauloDateOnly(context.now))
      throw badRequest("Revise a vigência: a data proposta já passou.");
    if (row.publishedAt) throw badRequest("Um dos alunos já foi publicado. Atualize a página.");
    if (row.blockers.length) throw badRequest(`${row.studentName}: ${row.blockers.join("; ")}.`);
    return row;
  });
  for (const row of selected)
    await assertTeacherEligible({
      database: context.database,
      teacherId: current.teacherId,
      date: dateOnly(row.effectiveDate ?? semester.startDate),
    });
  await assertNoTeacherConflict({
    database: context.database,
    teacherId: current.teacherId,
    from: selected.map((row) => dateOnly(row.effectiveDate ?? semester.startDate)).sort()[0]!,
    through: dateOnly(semester.endDate),
    slots: current.slots,
    ...(current.classId ? { excludeClassId: current.classId } : {}),
  });
  const classRow = current.classId
    ? { id: current.classId }
    : await createClass({
        database: context.database,
        recordedById: context.staffUser.id,
        values: {
          teacherId: current.teacherId,
          scheduleType: current.scheduleType,
          format: current.format,
          sharedStageId: current.sharedStageId,
          semesterId: semester.id,
          slots: current.slots,
        },
      });
  let generationRequestId: string | null = null;
  if (!current.classId) {
    await context.database.semesterClassPlan.update({
      where: { id: plan.id },
      data: { classId: classRow.id, version: { increment: 1 } },
    });
    generationRequestId = (
      await requestSessionGeneration(
        context.database,
        { classId: classRow.id },
        context.staffUser.id,
        context.now,
      )
    ).id;
  }
  for (const row of selected) {
    if (!row.stageId || !row.availability)
      throw badRequest("Confirme o estágio e a disponibilidade.");
    await publishOne(
      context,
      row,
      row.availability,
      classRow.id,
      row.effectiveDate ? new Date(row.effectiveDate) : semester.startDate,
    );
  }
  await recordActivity(context.database, context, "semesterOrganization.publish", {
    subject: { type: "class", id: classRow.id, name: current.name },
    description: `${selected.length} aluno(s) com entrada programada em ${dateOnly(semester.startDate).split("-").toReversed().join("/")}.`,
  });
  return { classId: classRow.id, count: selected.length, generationRequestId };
}
async function publishOne(
  context: OrganizationContext,
  row: PlacementRow,
  availability: CurrentAvailability,
  classId: string,
  entryDate: Date,
) {
  const immediate = dateOnly(entryDate) <= saoPauloDateOnly(context.now);
  if (row.sourceClassId === classId && row.mode === "CONTINUE") {
    await context.database.semesterPlacement.update({
      where: { id: row.id },
      data: {
        publishedAt: context.now,
        publishedById: context.staffUser.id,
        enrollmentId: row.sourceEnrollmentId,
        version: { increment: 1 },
      },
    });
    await recordPlacementRevision(context, row.id, "CONFIRMED_CONTINUITY");
    return;
  }
  let sourceExitActionId: string | null = null;
  if (row.sourceEnrollmentId) {
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
    sourceExitActionId = (
      await context.database.enrollmentAction.create({
        data: {
          enrollmentId: row.sourceEnrollmentId,
          kind: "EXIT",
          status: immediate ? "APPLIED" : "SCHEDULED",
          effectiveDate: entryDate,
          exitReason: "TRANSFERRED",
          recordedById: context.staffUser.id,
          justification: "Organização de turmas",
        },
      })
    ).id;
  }
  if (immediate && row.sourceEnrollmentId)
    await closeActiveEnrollment({
      database: context.database,
      enrollmentId: row.sourceEnrollmentId,
      effectiveDate: entryDate,
      reason: "TRANSFERRED",
    });
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
  await context.database.semesterPlacement.update({
    where: { id: row.id },
    data: {
      publishedAt: context.now,
      publishedById: context.staffUser.id,
      enrollmentId: created.enrollment.id,
      entryActionId: entry.id,
      sourceExitActionId,
      availabilityId: availability.id,
      version: { increment: 1 },
      publishedEvidence: {
        sourceProgressId: row.sourceProgressId,
        assessmentId: row.assessmentId,
        stagePlanId: row.stagePlanId,
        assessmentVersion: row.assessmentVersion,
      },
    },
  });
  await recordPlacementRevision(context, row.id, "PUBLISHED");
}
export async function withdrawPlacement(
  context: OrganizationContext,
  input: z.infer<typeof withdrawSemesterSchema>,
) {
  const placement = await context.database.semesterPlacement.findUnique({
    where: { id: input.id },
  });
  if (!placement) throw notFound("Proposta não encontrada.");
  await lockSemester(context, placement.semesterId);
  await lockStudentEnrollment(context.database, placement.studentId);
  const current = await context.database.semesterPlacement.findUniqueOrThrow({
    where: { id: input.id },
  });
  assertVersion(current.version, input.version);
  if (!current.publishedAt || !current.entryActionId)
    throw badRequest("Esta proposta não está publicada.");
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
  // Revision retains the published links; the proposal can then be edited and published again.
  await context.database.semesterPlacement.update({
    where: { id: current.id },
    data: { version: { increment: 1 } },
  });
  await recordPlacementRevision(context, current.id, "WITHDRAWN", input.reason);
  await context.database.semesterPlacement.update({
    where: { id: current.id },
    data: {
      publishedAt: null,
      publishedById: null,
      enrollmentId: null,
      entryActionId: null,
      sourceExitActionId: null,
      availabilityId: null,
    },
  });
  const student = await context.database.student.findUniqueOrThrow({
    where: { id: current.studentId },
  });
  await recordActivity(context.database, context, "semesterOrganization.withdraw", {
    subject: { type: "student", id: student.id, name: student.fullName },
    description: input.reason,
  });
  return { id: current.id };
}
