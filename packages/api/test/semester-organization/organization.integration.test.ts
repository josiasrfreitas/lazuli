import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { SESSIONS_GENERATE_WORKFLOW } from "@lazuli/job-contracts";
import { TRPCError } from "@trpc/server";
import {
  ensureTeacherFor,
  seedTwoStageCatalogFor,
  createStudentFor,
  createPersonalizedClassFor,
  cleanEnrollmentFixtures,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";

const config = {
  prefix: "Semester185 ",
  catalogKey: "semester185",
  catalogKeyPrefix: "semester185",
  teacherId: "00000000-0000-0000-0000-000000001850",
  teacherEmail: "semester185@example.com",
  teacherName: "Semester185 Teacher",
  semesterName: "Semester185 2085.1",
  semesterStart: "2085-02-01",
  semesterEnd: "2085-06-30",
};
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  role: "ADMIN",
  name: "Coordenação",
  email: "admin@example.com",
  isEnabled: true,
};
const slots = [{ weekday: "MONDAY" as const, startTime: "14:00", endTime: "15:00" }];
const caller = (role: StaffUser["role"] = "ADMIN") =>
  createCaller({
    db,
    staffUser: { ...admin, role },
    now: new Date("2085-05-15T15:00:00Z"),
    sessionGenerationQueue: {
      enqueueSessionsGenerate: async (payload) => ({
        workflowName: SESSIONS_GENERATE_WORKFLOW,
        jobId: "semester185-job",
        payload,
      }),
    },
  });
async function clean() {
  const semesters = await db.semester.findMany({
    where: { name: { startsWith: config.prefix } },
    select: { id: true },
  });
  const ids = semesters.map((row) => row.id);
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: config.prefix } } });
  await db.semesterPlacementRevision.deleteMany({
    where: { placement: { semesterId: { in: ids } } },
  });
  await db.semesterPlacement.deleteMany({ where: { semesterId: { in: ids } } });
  await db.studentAvailability.deleteMany({ where: { semesterId: { in: ids } } });
  await db.semesterClassPlan.deleteMany({ where: { semesterId: { in: ids } } });
  await db.sessionGenerationRequest.deleteMany({
    where: { OR: [{ semesterId: { in: ids } }, { class: { semesterId: { in: ids } } }] },
  });
  await db.activityEvent.deleteMany({ where: { subjectName: { startsWith: config.prefix } } });
  // Production-created classes have generated codes; remove only this suite's future classes.
  const classes = await db.class.findMany({
    where: { semesterId: { in: ids } },
    select: { id: true },
  });
  const classIds = classes.map((row) => row.id);
  await db.enrollmentAction.deleteMany({ where: { enrollment: { classId: { in: classIds } } } });
  await db.pedagogicalProgress.deleteMany({ where: { enrollment: { classId: { in: classIds } } } });
  await db.enrollment.deleteMany({ where: { classId: { in: classIds } } });
  await db.stagePlanRevision.deleteMany({
    where: { plan: { stage: { name: { startsWith: config.prefix } } } },
  });
  await db.stagePlan.deleteMany({ where: { stage: { name: { startsWith: config.prefix } } } });
  await db.stageAssessment.deleteMany({
    where: { stage: { name: { startsWith: config.prefix } } },
  });
  await db.classTeacherAssignment.deleteMany({ where: { classId: { in: classIds } } });
  await db.classScheduleSlot.deleteMany({ where: { classId: { in: classIds } } });
  await db.class.deleteMany({ where: { id: { in: classIds } } });
  await db.semester.deleteMany({ where: { id: { in: ids } } });
  await cleanEnrollmentFixtures(config);
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
async function fixture() {
  await ensureTeacherFor(config);
  const catalog = await seedTwoStageCatalogFor(config);
  const sourceClass = await createPersonalizedClassFor(config, {
    code: "source",
    semesterId: catalog.semesterId,
  });
  const semester = await db.semester.create({
    data: {
      name: `${config.prefix}2085.2`,
      startDate: new Date("2085-07-01"),
      endDate: new Date("2085-12-31"),
    },
  });
  const plan = await caller().semesterOrganization.savePlan({
    semesterId: semester.id,
    name: `${config.prefix}PPT`,
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    sharedStageId: null,
    teacherId: config.teacherId,
    slots,
  });
  async function student(suffix: string, confirmed = true) {
    const row = await createStudentFor(config, { suffix });
    const source = await caller().enrollment.create({
      studentId: row.id,
      classId: sourceClass.id,
      stageId: catalog.firstStageId,
    });
    const proposal = await caller().semesterOrganization.savePlacement({
      semesterId: semester.id,
      studentId: row.id,
      planId: plan.id,
      stageId: catalog.firstStageId,
      sourceProgressId: source.progress.id,
      mode: "CONTINUE",
    });
    const availability = confirmed
      ? await caller().semesterOrganization.confirmAvailability({
          semesterId: semester.id,
          studentId: row.id,
          previousId: null,
          validUntil: "2085-07-01",
          formats: ["IN_PERSON"],
          slots,
        })
      : null;
    return { ...row, source, proposal, availability };
  }
  return { catalog, semester, plan, student, sourceClass };
}

void it("publishes only selected eligible students, preserving the current PPT attempt and both temporal memberships", async () => {
  const scope = await fixture();
  const first = await scope.student("Ana");
  const second = await scope.student("Bia", false);
  const lead = await db.admissionCandidate.create({
    data: {
      fullName: `${config.prefix}Ana`,
      phone: "11999990000",
      studentId: first.id,
      englishExperience: "NONE",
      stageId: scope.catalog.firstStageId,
      status: "WAITING",
      recordedById: admin.id,
    },
  });
  const assessment = await db.stageAssessment.create({
    data: {
      studentId: first.id,
      stageId: scope.catalog.firstStageId,
      startedOn: new Date("2085-05-15"),
      createdById: admin.id,
    },
  });
  const plan = await db.stagePlan.create({
    data: {
      studentId: first.id,
      stageId: scope.catalog.firstStageId,
      plannedStartOn: new Date("2085-05-15"),
      plannedEndOn: new Date("2085-09-01"),
      createdById: admin.id,
    },
  });
  await db.pedagogicalProgress.update({
    where: { id: first.source.progress.id },
    data: { assessmentId: assessment.id, stagePlanId: plan.id },
  });
  const published = await caller().semesterOrganization.publish({
    planId: scope.plan.id,
    version: 1,
    placements: [{ id: first.proposal.id, version: 1 }],
  });
  const future = await db.enrollment.findFirstOrThrow({
    where: { studentId: first.id, classId: published.classId },
    include: { progressRecords: true, actions: true },
  });
  assert.equal(published.count, 1);
  const converted = await db.admissionCandidate.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(converted.status, "ENROLLED");
  assert.equal(converted.enrollmentId, future.id);
  assert.equal(future.entryDate.toISOString().slice(0, 10), "2085-07-01");
  assert.equal(future.progressRecords[0]?.assessmentId, assessment.id);
  assert.equal(future.progressRecords[0]?.stagePlanId, plan.id);
  assert.equal(future.actions[0]?.status, "SCHEDULED");
  const origin = await db.enrollment.findUniqueOrThrow({
    where: { id: first.source.enrollment.id },
    include: { actions: true, progressRecords: true },
  });
  assert.equal(origin.exitDate, null);
  assert.equal(origin.progressRecords[0]?.endDate, null);
  assert.equal(origin.actions.find((row) => row.kind === "EXIT")?.exitReason, "TRANSFERRED");
  const unselected = await db.semesterPlacement.findUniqueOrThrow({
    where: { id: second.proposal.id },
  });
  assert.equal(unselected.publishedAt, null);
  await assert.rejects(
    caller().enrollment.cancelScheduled({ actionId: future.actions[0]!.id }),
    /organização do próximo semestre/u,
  );
  await caller().semesterOrganization.withdraw({
    id: first.proposal.id,
    version: 2,
    reason: "Família pediu outro horário para o próximo período.",
  });
  assert.equal(await db.enrollment.count({ where: { id: future.id } }), 0);
  const reopened = await db.admissionCandidate.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(reopened.status, "WAITING");
  assert.equal(reopened.enrollmentId, null);
  assert.equal(reopened.allocationPlanId, scope.plan.id);
  assert.equal(
    reopened.allocationPendingReason,
    "Família pediu outro horário para o próximo período.",
  );
  const retained = await db.enrollment.findUniqueOrThrow({ where: { id: origin.id } });
  assert.equal(retained.exitDate, null);
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: origin.id, kind: "EXIT", status: "SCHEDULED" },
    }),
    0,
  );
  const history = await caller().semesterOrganization.history({ id: first.proposal.id });
  assert.deepEqual(
    history.map((row) => row.action),
    ["WITHDRAWN", "PUBLISHED", "PROPOSED"],
  );
});

void it("rechecks latest availability and refuses an invalid subset atomically", async () => {
  const scope = await fixture();
  const first = await scope.student("Cris");
  const second = await scope.student("Dani", false);
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [
        { id: first.proposal.id, version: 1 },
        { id: second.proposal.id, version: 1 },
      ],
    }),
    /Confirme a disponibilidade/u,
  );
  assert.equal(await db.class.count({ where: { semesterId: scope.semester.id } }), 0);
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: first.source.enrollment.id, kind: "EXIT" },
    }),
    0,
  );
  await caller().semesterOrganization.invalidateAvailability({
    semesterId: scope.semester.id,
    studentId: first.id,
    previousId: first.availability!.id,
    reason: "Aluno informou mudança de horário de trabalho.",
  });
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [{ id: first.proposal.id, version: 1 }],
    }),
    /Confirme a disponibilidade/u,
  );
  const current = await db.enrollment.findUniqueOrThrow({
    where: { id: first.source.enrollment.id },
  });
  assert.equal(current.exitDate, null);
  await assert.rejects(
    caller("TEACHER").semesterOrganization.detail({ semesterId: scope.semester.id }),
    { code: "FORBIDDEN" },
  );
});

void it("rejects regular continuity into another semester before creating a future membership", async () => {
  const scope = await fixture();
  const first = await scope.student("Repetition");
  await db.class.update({
    where: { id: scope.sourceClass.id },
    data: { scheduleType: "REGULAR", sharedStageId: scope.catalog.firstStageId },
  });
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [{ id: first.proposal.id, version: 1 }],
    }),
    /Continuidade no mesmo estágio exige origem e destino PPT/u,
  );
  assert.equal(await db.class.count({ where: { semesterId: scope.semester.id } }), 0);
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: first.source.enrollment.id, kind: "EXIT" },
    }),
    0,
  );
});

void it("serializes duplicate publication and rejects a stale proposal version without a second enrollment", async () => {
  const scope = await fixture();
  const student = await scope.student("Eva");
  const input = {
    planId: scope.plan.id,
    version: 1,
    placements: [{ id: student.proposal.id, version: 1 }],
  };
  const results = await Promise.allSettled([
    caller().semesterOrganization.publish(input),
    caller().semesterOrganization.publish(input),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    results
      .map((result) => (result.status === "rejected" ? String(result.reason) : "published"))
      .join("\n"),
  );
  const rejection = results.find((result) => result.status === "rejected");
  const reason: unknown = rejection?.reason;
  assert.ok(reason instanceof TRPCError);
  assert.equal(reason.code, "CONFLICT");
  assert.equal(
    await db.enrollment.count({
      where: { studentId: student.id, class: { semesterId: scope.semester.id } },
    }),
    1,
  );
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: student.source.enrollment.id, status: "SCHEDULED", kind: "EXIT" },
    }),
    1,
  );
});

void it("requires explicit confirmation for availability inherited by preparation or movement between semesters", async () => {
  const scope = await fixture();
  const student = await createStudentFor(config, { suffix: "Inherited availability" });
  await db.classScheduleSlot.create({
    data: {
      classId: scope.sourceClass.id,
      weekday: "MONDAY",
      startTime: new Date("1970-01-01T14:00:00Z"),
      endTime: new Date("1970-01-01T15:00:00Z"),
    },
  });
  await caller().enrollment.create({
    studentId: student.id,
    classId: scope.sourceClass.id,
    stageId: scope.catalog.firstStageId,
  });
  await db.studentAvailability.create({
    data: {
      semesterId: scope.catalog.semesterId,
      studentId: student.id,
      confirmed: true,
      validUntil: new Date("2085-04-30"),
      formats: ["IN_PERSON"],
      slots,
      recordedById: admin.id,
    },
  });
  await caller().semesterOrganization.prepare({ semesterId: scope.semester.id });
  const prepared = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const proposal = prepared.placements.find((row) => row.studentId === student.id)!;
  const plan = prepared.plans.find((row) => row.id === proposal.planId)!;
  const inherited = await db.studentAvailability.findFirstOrThrow({
    where: { semesterId: scope.semester.id, studentId: student.id },
  });
  assert.equal(inherited.confirmed, false);
  assert.ok(proposal.blockers.some((reason) => reason.includes("Confirme a disponibilidade")));
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: plan.id,
      version: plan.version,
      placements: [{ id: proposal.id, version: proposal.version }],
    }),
    /Confirme a disponibilidade/u,
  );
  await caller().semesterOrganization.confirmAvailability({
    semesterId: scope.semester.id,
    studentId: student.id,
    previousId: inherited.id,
    validUntil: "2085-12-31",
    formats: ["IN_PERSON"],
    slots,
  });
  const later = await db.semester.create({
    data: {
      name: `${config.prefix}2086.1`,
      startDate: new Date("2086-02-01"),
      endDate: new Date("2086-06-30"),
    },
  });
  const laterPlan = await caller().semesterOrganization.savePlan({
    semesterId: later.id,
    name: `${config.prefix}PPT later`,
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    sharedStageId: null,
    teacherId: config.teacherId,
    slots,
  });
  await caller().semesterOrganization.move({
    semesterId: scope.semester.id,
    targetSemesterId: later.id,
    selections: [{ id: proposal.id, version: proposal.version }],
    planId: laterPlan.id,
    effectiveDate: "2086-02-01",
    reason: "Revisar disponibilidade no novo período",
  });
  const moved = await caller().semesterOrganization.detail({ semesterId: later.id });
  const movedProposal = moved.placements.find((row) => row.studentId === student.id)!;
  const copied = await db.studentAvailability.findFirstOrThrow({
    where: { semesterId: later.id, studentId: student.id },
  });
  assert.equal(copied.confirmed, false);
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: laterPlan.id,
      version: moved.plans.find((row) => row.id === laterPlan.id)!.version,
      placements: [{ id: movedProposal.id, version: movedProposal.version }],
    }),
    /Confirme a disponibilidade/u,
  );
  assert.equal(
    await db.enrollment.count({
      where: { studentId: student.id, class: { semesterId: later.id } },
    }),
    0,
  );
  await caller().semesterOrganization.confirmAvailability({
    semesterId: later.id,
    studentId: student.id,
    previousId: copied.id,
    validUntil: "2086-06-30",
    formats: ["IN_PERSON"],
    slots,
  });
  const published = await caller().semesterOrganization.publish({
    planId: laterPlan.id,
    version: moved.plans.find((row) => row.id === laterPlan.id)!.version,
    placements: [{ id: movedProposal.id, version: movedProposal.version }],
  });
  assert.equal(published.count, 1);
  assert.equal(
    await db.enrollment.count({
      where: { studentId: student.id, class: { semesterId: later.id } },
    }),
    1,
  );
});
