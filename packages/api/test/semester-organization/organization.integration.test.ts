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
const caller = (role: StaffUser["role"] = "ADMIN"): ReturnType<typeof createCaller> =>
  createCaller({
    db,
    staffUser: { ...admin, role },
    now: new Date("2085-05-15T15:00:00Z"),
    sessionGenerationQueue: {
      enqueueSessionsGenerate: (payload) =>
        Promise.resolve({
          workflowName: SESSIONS_GENERATE_WORKFLOW,
          jobId: "semester185-job",
          payload,
        }),
    },
  });
async function clean(): Promise<void> {
  const semesters = await db.period.findMany({
    where: { name: { startsWith: config.prefix } },
    select: { id: true },
  });
  const ids = semesters.map((row) => row.id);
  const students = { fullName: { startsWith: config.prefix } };
  const sales = { contract: { student: students } };
  await db.materialOrder.deleteMany({ where: { order: sales } });
  await db.order.deleteMany({ where: sales });
  await db.studentHealthPending.deleteMany({ where: { student: students } });
  await db.makeupCoverage.deleteMany({ where: { appointment: { student: students } } });
  await db.pedagogicalAppointment.deleteMany({ where: { student: students } });
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: config.prefix } } });
  await db.semesterPlacementRevision.deleteMany({
    where: { placement: { semesterId: { in: ids } } },
  });
  await db.semesterPlacement.deleteMany({ where: { semesterId: { in: ids } } });

  await db.calendarReconciliationRequest.deleteMany({ where: { semesterId: { in: ids } } });
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
  await db.attendance.deleteMany({ where: { classSession: { classId: { in: classIds } } } });
  await db.classSession.deleteMany({ where: { classId: { in: classIds } } });
  await db.classAppointmentSeries.deleteMany({ where: { classId: { in: classIds } } });
  await db.enrollment.deleteMany({ where: { classId: { in: classIds } } });
  await db.stagePlanRevision.deleteMany({
    where: { plan: { stage: { name: { startsWith: config.prefix } } } },
  });
  await db.stagePlan.deleteMany({ where: { stage: { name: { startsWith: config.prefix } } } });
  await db.assessmentGrade.deleteMany({
    where: { assessment: { student: { fullName: { startsWith: config.prefix } } } },
  });
  await db.stageAssessment.deleteMany({
    where: { stage: { name: { startsWith: config.prefix } } },
  });
  await db.classTeacherAssignment.deleteMany({ where: { classId: { in: classIds } } });
  await db.classScheduleSlot.deleteMany({ where: { classId: { in: classIds } } });
  await db.class.deleteMany({ where: { id: { in: classIds } } });
  await db.period.deleteMany({ where: { id: { in: ids } } });
  await cleanEnrollmentFixtures(config);
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
type FixtureStudent = {
  id: string;
  source: { progress: { id: string }; enrollment: { id: string } };
  proposal: { id: string };
};
type Fixture = {
  catalog: { semesterId: string; firstStageId: string; secondStageId: string };
  semester: { id: string };
  plan: { id: string };
  sourceClass: { id: string };
  student: (suffix: string, manual?: boolean) => Promise<FixtureStudent>;
};

async function fixture(): Promise<Fixture> {
  await ensureTeacherFor(config);
  const catalog = await seedTwoStageCatalogFor(config);
  const sourceClass = await createPersonalizedClassFor(config, {
    code: "source",
    semesterId: catalog.semesterId,
  });
  const semester = await db.period.create({
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
  async function student(suffix: string, manual = true): Promise<FixtureStudent> {
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
    if (manual)
      await db.semesterPlacement.update({
        where: { id: proposal.id },
        data: { continuity: "STAY" },
      });
    return { ...row, source, proposal };
  }
  return { catalog, semester, plan, student, sourceClass };
}

async function ownClass(scope: Fixture): Promise<void> {
  await db.semesterClassPlan.update({
    where: { id: scope.plan.id },
    data: { sourceClassId: scope.sourceClass.id },
  });
}

async function acquireMaterial(studentId: string, stageId: string): Promise<void> {
  const contract = await db.contract.findFirstOrThrow({ where: { studentId } });
  await db.order.create({
    data: {
      contractId: contract.id,
      kind: "MATERIAL",
      principalAmountCents: 10000,
      startDate: new Date("2085-05-15"),
      dueDay: 15,
      material: {
        create: {
          stageId,
          name: "Workbook",
          stageCode: "W1",
          category: "ADULT",
          payment: "CASH",
          listPriceCents: 10000,
          cashDiscountPct: 0,
          quotedInstallments: 1,
          quotedInstallmentCents: 10000,
        },
      },
    },
  });
}

void it("presumes continuity and accepts legacy stay input without creating a contract or enrollment", async () => {
  const scope = await fixture();
  const student = await scope.student("Continuity", false);
  await ownClass(scope);
  await acquireMaterial(student.id, scope.catalog.firstStageId);
  const initial = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  assert.equal(initial.semester.id, scope.semester.id);
  assert.deepEqual(
    initial.plans.map((plan) => plan.id),
    [scope.plan.id],
  );
  const [initialPlan] = initial.plans;
  const [initialPlacement] = initial.placements;
  assert.ok(initialPlan);
  assert.ok(initialPlacement);
  assert.equal(initialPlan.name, "PPT SEG/14:00-15:00 Semester185 Teacher");
  assert.equal(initialPlan.startDate.toISOString().slice(0, 10), "2085-07-01");
  assert.equal(initialPlacement.confirmation, "PRECONFIRMED");

  await caller().semesterOrganization.continuity({
    semesterId: scope.semester.id,
    id: student.proposal.id,
    version: initialPlacement.version,
    continuity: "STAY",
  });
  const confirmed = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const [confirmedPlacement] = confirmed.placements;
  assert.ok(confirmedPlacement);
  assert.equal(confirmedPlacement.confirmation, "PRECONFIRMED");
  assert.equal(confirmedPlacement.publishedAt, null);
  assert.equal(await db.contract.count({ where: { studentId: student.id } }), 1);
  assert.equal(await db.enrollment.count({ where: { studentId: student.id } }), 1);
});

void it("allows a new placement in the same track after an unfinished proposal was removed", async () => {
  const scope = await fixture();
  const student = await scope.student("Recreated intake");
  await db.semesterPlacement.update({
    where: { id: student.proposal.id },
    data: { deletedAt: new Date("2085-05-15T15:00:00.000Z") },
  });
  const recreated = await caller().semesterOrganization.savePlacement({
    semesterId: scope.semester.id,
    studentId: student.id,
    planId: scope.plan.id,
    stageId: scope.catalog.firstStageId,
    sourceProgressId: student.source.progress.id,
    mode: "CONTINUE",
  });
  assert.notEqual(recreated.id, student.proposal.id);
  assert.equal(
    await db.semesterPlacement.count({
      where: {
        semesterId: scope.semester.id,
        studentId: student.id,
        trackId: { not: null },
        deletedAt: null,
      },
    }),
    1,
  );
});

async function seedPassingResults(
  scope: Fixture,
  students: Pick<FixtureStudent, "id" | "source">[],
): Promise<void> {
  const date = new Date("2085-05-15");
  const session = await db.classSession.create({
    data: {
      classId: scope.sourceClass.id,
      date,
      startTime: new Date("1970-01-01T14:00Z"),
      endTime: new Date("1970-01-01T15:00Z"),
      attendanceConfirmedAt: date,
    },
  });
  for (const student of students) {
    const assessment = await db.stageAssessment.create({
      data: {
        studentId: student.id,
        stageId: scope.catalog.firstStageId,
        startedOn: date,
        createdById: admin.id,
        grades: {
          create: (["BLOCK_ONE", "BLOCK_TWO"] as const).flatMap((phase) =>
            (["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"] as const).map((competence) => ({
              phase,
              competence,
              score: 80,
              assessedOn: date,
              recordedById: admin.id,
            })),
          ),
        },
      },
    });
    await db.pedagogicalProgress.update({
      where: { id: student.source.progress.id },
      data: { assessmentId: assessment.id },
    });
    await db.attendance.create({
      data: {
        enrollmentId: student.source.enrollment.id,
        classSessionId: session.id,
        status: "PRESENT",
      },
    });
  }
}
void it("requires continuous coverage beyond the midpoint of the selected period", async () => {
  const scope = await fixture();
  const covered = await scope.student("Covered", false);
  const short = await scope.student("Short", false);
  await db.contract.updateMany({
    where: { studentId: { in: [covered.id, short.id] } },
    data: { endsOn: new Date("2085-06-30") },
  });
  await ownClass(scope);
  for (const student of [covered, short])
    await acquireMaterial(student.id, scope.catalog.firstStageId);
  await seedPassingResults(scope, [covered, short]);
  const payer = await db.payer.create({ data: { name: `${config.prefix}Coverage payer` } });
  try {
    await db.contract.createMany({
      data: [
        {
          studentId: covered.id,
          payerId: payer.id,
          startsOn: new Date("2085-01-01"),
          endsOn: new Date("2085-10-01"),
        },
        {
          studentId: short.id,
          payerId: payer.id,
          startsOn: new Date("2085-01-01"),
          endsOn: new Date("2085-09-30"),
        },
      ],
    });
    const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
    assert.equal(
      board.placements.find((row) => row.studentId === covered.id)?.confirmation,
      "PRECONFIRMED",
    );
    assert.equal(
      board.placements.find((row) => row.studentId === short.id)?.confirmation,
      "BLOCKED",
    );
  } finally {
    await db.contract.deleteMany({ where: { payerId: payer.id } });
    await db.payer.delete({ where: { id: payer.id } });
  }
});

void it("keeps future class interest as a lead and scopes it to the chosen period", async () => {
  const scope = await fixture();
  const lead = await db.admissionCandidate.create({
    data: {
      fullName: `${config.prefix}Future lead`,
      phone: "11999990001",
      englishExperience: "NONE",
      stageId: scope.catalog.firstStageId,
      scheduleType: "PERSONALIZED",
      format: "IN_PERSON",
      status: "WAITING",
      allocationPendingAt: new Date("2085-05-15"),
      allocationPendingReason: "Aguarda o próximo período",
      recordedById: admin.id,
    },
  });
  await caller().semesterOrganization.assignLeadInterest({
    leadId: lead.id,
    planId: scope.plan.id,
  });
  const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  assert.equal(
    board.waitingLeads.find((row) => row.id === lead.id)?.allocationPlanId,
    scope.plan.id,
  );
  assert.equal(board.placements.length, 0);
  const current = await caller().semesterOrganization.detail({
    semesterId: scope.catalog.semesterId,
  });
  assert.equal(
    current.waitingLeads.some((row) => row.id === lead.id),
    false,
  );
  const retained = await db.admissionCandidate.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(retained.status, "WAITING");
  assert.equal(retained.studentId, null);
  assert.equal(retained.enrollmentId, null);
  const input = { semesterId: scope.semester.id };
  const service = caller().semesterOrganization;
  const preview = await service.resetPreview(input);
  assert.equal(preview.release, 0);
  assert.equal(preview.leads, 1);
  assert.deepEqual(await service.reset({ ...input, fingerprint: preview.fingerprint }), {
    released: 0,
    leads: 1,
  });
  const { waitingLeads } = await service.detail(input);
  const [returned] = waitingLeads;
  assert.equal(returned?.id, lead.id);
  assert.equal(returned.allocationPlanId, null);
  assert.equal(returned.allocationPendingReason, "Aguarda o próximo período");
});

void it("publishes only selected eligible students, preserving the current PPT attempt and both temporal memberships", async () => {
  const scope = await fixture();
  const first = await scope.student("Ana");
  const second = await scope.student("Bia");
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
    caller().enrollment.cancelScheduled({ actionId: future.actions[0].id }),
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

void it("extends the class boundary and requests generation when a later batch enters earlier", async () => {
  const scope = await fixture();
  const late = await scope.student("Late batch");
  const early = await scope.student("Early batch");
  await db.semesterPlacement.update({
    where: { id: late.proposal.id },
    data: { effectiveDate: new Date("2085-10-15") },
  });
  await db.semesterPlacement.update({
    where: { id: early.proposal.id },
    data: { effectiveDate: new Date("2085-10-01") },
  });

  const first = await caller().semesterOrganization.publish({
    planId: scope.plan.id,
    version: 1,
    placements: [{ id: late.proposal.id, version: 1 }],
  });
  assert.ok(first.generation);
  const earlierBatch = {
    planId: scope.plan.id,
    version: 2,
    placements: [{ id: early.proposal.id, version: 1 }],
  };
  await assert.rejects(
    caller().semesterOrganization.publish(earlierBatch),
    /As aulas já estão sendo preparadas/u,
  );
  const unchanged = await db.class.findUniqueOrThrow({ where: { id: first.classId } });
  assert.equal(unchanged.startDate?.toISOString().slice(0, 10), "2085-10-15");
  assert.equal(
    await db.enrollment.count({ where: { studentId: early.id, classId: first.classId } }),
    0,
  );
  await db.sessionGenerationRequest.update({
    where: { id: first.generation.id },
    data: { status: "SUCCEEDED", completedAt: new Date("2085-05-15T15:01:00Z") },
  });

  const second = await caller().semesterOrganization.publish(earlierBatch);
  const classRow = await db.class.findUniqueOrThrow({ where: { id: first.classId } });
  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { studentId: early.id, classId: first.classId },
  });
  assert.equal(second.classId, first.classId);
  assert.equal(classRow.startDate?.toISOString().slice(0, 10), "2085-10-01");
  assert.equal(enrollment.entryDate.toISOString().slice(0, 10), "2085-10-01");
  assert.ok(second.generation);
  assert.notEqual(second.generation.id, first.generation.id);
});

void it("rejects an inactive student atomically", async () => {
  const scope = await fixture();
  const first = await scope.student("Cris");
  const second = await scope.student("Dani");
  await db.student.update({ where: { id: second.id }, data: { status: "INACTIVE" } });
  await assert.rejects(
    caller().semesterOrganization.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [
        { id: first.proposal.id, version: 1 },
        { id: second.proposal.id, version: 1 },
      ],
    }),
    /Cadastro do aluno não está ativo/u,
  );
  assert.equal(await db.class.count({ where: { semesterId: scope.semester.id } }), 0);
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: first.source.enrollment.id, kind: "EXIT" },
    }),
    0,
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
  const reason = rejection?.reason as Error;
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

type FormationCaller = ReturnType<typeof caller>["semesterOrganization"];

void it("permits a valid transfer without labeling it continuity", async () => {
  const scope = await fixture();
  const student = await scope.student("Early renewal", false);
  await seedPassingResults(scope, [student]);
  const contract = await db.contract.findFirstOrThrow({ where: { studentId: student.id } });
  await db.contract.update({
    where: { id: contract.id },
    data: { endsOn: new Date("2085-09-30") },
  });
  const publish = (version: number): ReturnType<FormationCaller["publish"]> =>
    caller().semesterOrganization.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [{ id: student.proposal.id, version }],
    });
  await db.contract.update({
    where: { id: contract.id },
    data: { endsOn: new Date("2085-06-30") },
  });
  await assert.rejects(publish(1), /Sem contrato vigente/u);
  await db.contract.update({
    where: { id: contract.id },
    data: { endsOn: new Date("2085-09-30") },
  });
  const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  assert.equal(board.placements[0]?.confirmation, "PENDING");
  const result = await publish(1);
  assert.equal(result.count, 1);
});
void it("postpones an entry, then dissolves a future class into the same waiting list without closing its source", async () => {
  const scope = await fixture(),
    student = await scope.student("Transfer");
  const publication = await caller().semesterOrganization.publish({
    planId: scope.plan.id,
    version: 1,
    placements: [{ id: student.proposal.id, version: 1 }],
  });
  await caller().semesterOrganization.postpone({
    planId: scope.plan.id,
    version: 2,
    startsOn: "2085-07-15",
  });
  let board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  assert.equal(board.placements[0]?.publishedAt, null);
  assert.equal(board.placements[0]?.effectiveDate?.toISOString().slice(0, 10), "2085-07-15");
  const extraDate = new Date("2086-01-07");
  await seedOffPeriodExtra(publication.classId, extraDate);
  await caller().semesterOrganization.continuity({
    id: student.proposal.id,
    version: board.placements[0].version,
    semesterId: scope.semester.id,
    continuity: "LEAVING",
    reason: "Relato da família.",
    attentionNote: "Novo turno de trabalho.",
  });
  const second = await scope.student("Outro aluno");
  const dissolved = await caller().semesterOrganization.dissolveClass({ id: publication.classId });
  assert.ok(dissolved.reconciliationRequestId);
  const request = await db.calendarReconciliationRequest.findUniqueOrThrow({
    where: { id: dissolved.reconciliationRequestId },
  });
  assert.equal(request.throughDate.getTime(), extraDate.getTime());
  board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  assert.equal(board.plans[0]?.active, false);
  const affected = board.placements.find((item) => item.id === student.proposal.id)!;
  assert.equal(affected.planId, null);
  assert.equal(affected.continuity, "LEAVING");
  assert.equal(affected.continuityReason, "Relato da família.");
  assert.equal(affected.attentionNote, "Novo turno de trabalho.");
  assert.equal(affected.confirmation, "BLOCKED");
  for (const reason of ["Turma encerrada", "Risco de saída", "Impedimento sinalizado pela equipe"])
    assert.ok(affected.blockers.includes(reason));
  assert.ok(
    board.placements
      .find((item) => item.id === second.proposal.id)!
      .blockers.includes("Turma encerrada"),
  );
  const history = await caller().semesterOrganization.caseHistory({ id: student.proposal.id });
  assert.equal(history[0]?.kind, "CLASS_DISSOLVED");
  const source = await db.enrollment.findUniqueOrThrow({
    where: { id: student.source.enrollment.id },
  });
  assert.equal(source.exitDate, null);
});
void it("dissolves an operational class before preparation and clears only the closure when a new class is chosen", async () => {
  const scope = await fixture();
  const first = await scope.student("Encerramento operacional");
  const second = await scope.student("Segundo aluno da turma");
  const semesterId = scope.catalog.semesterId;
  const stage = await db.stage.findUniqueOrThrow({ where: { id: scope.catalog.firstStageId } });
  const suspended = await db.semesterPlacement.create({
    data: {
      semesterId,
      studentId: first.id,
      trackId: stage.trackId,
      stageId: scope.catalog.firstStageId,
      mode: "CONTINUE",
      enrollmentId: first.source.enrollment.id,
      publishedAt: new Date("2085-05-10"),
      recordedById: admin.id,
      attentionNote: "Rever o horário do aluno.",
      exitRiskActive: true,
    },
  });
  await caller().semesterOrganization.dissolveClass({ id: scope.sourceClass.id });
  const board = await caller().semesterOrganization.detail({ semesterId });
  const firstRow = board.placements.find((item) => item.id === suspended.id)!;
  const secondRow = board.placements.find((item) => item.studentId === second.id)!;
  assert.equal(firstRow.publishedAt, null);
  assert.equal(secondRow.classClosurePending, true);
  assert.equal(firstRow.classClosurePending, true);
  assert.ok(firstRow.blockers.includes("Impedimento sinalizado pela equipe"));
  const otherPlan = await caller().semesterOrganization.savePlan({
    semesterId,
    name: config.prefix + "Alternativa",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    sharedStageId: null,
    teacherId: config.teacherId,
    slots,
  });
  await caller().semesterOrganization.savePlacement({
    semesterId,
    studentId: first.id,
    id: firstRow.id,
    version: firstRow.version,
    planId: otherPlan.id,
    sourceProgressId: null,
    stageId: scope.catalog.firstStageId,
    mode: "ENTRY",
  });
  const placed = await db.semesterPlacement.findUniqueOrThrow({ where: { id: firstRow.id } });
  assert.equal(placed.classClosurePending, false);
  assert.equal(placed.exitRiskActive, true);
  assert.equal(placed.attentionNote, "Rever o horário do aluno.");
});
async function seedOffPeriodExtra(classId: string, date: Date): Promise<void> {
  const series = await db.classAppointmentSeries.create({
    data: {
      classId,
      teacherId: config.teacherId,
      scheduledById: admin.id,
      fromDate: date,
      throughDate: date,
      schedule: [],
      reason: "Aula extra após o período",
    },
  });
  await db.classSession.create({
    data: {
      classId,
      appointmentSeriesId: series.id,
      date,
      startTime: new Date("1970-01-01T14:00Z"),
      endTime: new Date("1970-01-01T15:00Z"),
    },
  });
}

void it("keeps a manual engagement concern independent of passing marks, attendance and contract", async () => {
  const scope = await fixture(),
    student = await scope.student("Acompanhamento", false);
  await ownClass(scope);
  await acquireMaterial(student.id, scope.catalog.firstStageId);
  await seedPassingResults(scope, [student]);
  const detail = (): ReturnType<FormationCaller["detail"]> =>
    caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const initialBoard = await detail();
  assert.equal(initialBoard.placements[0]?.confirmation, "PRECONFIRMED");
  await caller().semesterOrganization.continuity({
    semesterId: scope.semester.id,
    id: student.proposal.id,
    version: 1,
    continuity: "UNDECIDED",
    attentionNote: "Família pediu contato.",
  });
  const afterAttention = await detail();
  const row = afterAttention.placements[0]!;
  assert.equal(row.confirmation, "BLOCKED");
  assert.deepEqual(row.blockers, ["Impedimento sinalizado pela equipe"]);
  await caller().semesterOrganization.continuity({
    semesterId: scope.semester.id,
    id: student.proposal.id,
    version: row.version,
    continuity: "UNDECIDED",
    attentionNote: "",
    reason: "Retomar contato na sexta-feira.",
  });
  const resolvedBoard = await detail();
  const resolved = resolvedBoard.placements[0]!;
  assert.equal(resolved.confirmation, "PRECONFIRMED");
  assert.deepEqual(resolved.blockers, []);
  await db.semesterPlacement.update({
    where: { id: student.proposal.id },
    data: { exitRiskActive: true },
  });
  const riskBoard = await detail();
  const risk = riskBoard.placements[0]!;
  assert.equal(risk.confirmation, "BLOCKED");
  assert.deepEqual(risk.blockers, ["Risco de saída"]);
  await caller().semesterOrganization.riskLimit({
    semesterId: scope.semester.id,
    previous: 4,
    limit: 3,
  });
  const afterRiskLimit = await detail();
  assert.equal(afterRiskLimit.semester.formationRiskLimit, 3);
});

void it("keeps an unassigned new student in the next period's queue across repeated preparation", async () => {
  const scope = await fixture();
  const student = await createStudentFor(config, { suffix: "Waiting for regular" });
  await caller().semesterOrganization.savePlacement({
    semesterId: scope.catalog.semesterId,
    studentId: student.id,
    stageId: scope.catalog.firstStageId,
    planId: null,
    sourceProgressId: null,
    mode: "ENTRY",
  });
  await caller().semesterOrganization.prepare({ semesterId: scope.semester.id });
  await caller().semesterOrganization.prepare({ semesterId: scope.semester.id });
  const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const waiting = board.placements.filter((row) => row.studentId === student.id);
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0]?.stageId, scope.catalog.firstStageId);
  assert.equal(waiting[0]?.planId, null);
});

void it("carries a healthy regular cohort forward to the next stage with its teacher, weekly slot and lineage", async () => {
  const scope = await fixture();
  await db.semesterClassPlan.delete({ where: { id: scope.plan.id } });
  await db.class.update({
    where: { id: scope.sourceClass.id },
    data: {
      scheduleType: "REGULAR",
      sharedStageId: scope.catalog.firstStageId,
      scheduleSlots: {
        create: {
          weekday: "MONDAY",
          startTime: new Date("1970-01-01T14:00Z"),
          endTime: new Date("1970-01-01T15:00Z"),
        },
      },
    },
  });
  const student = await createStudentFor(config, { suffix: "Regular cohort" });
  const source = await caller().enrollment.create({
    studentId: student.id,
    classId: scope.sourceClass.id,
  });
  await seedPassingResults(scope, [{ ...student, source }]);
  await acquireMaterial(student.id, scope.catalog.secondStageId);
  const prepare = (): ReturnType<FormationCaller["prepare"]> =>
    caller().semesterOrganization.prepare({ semesterId: scope.semester.id });
  assert.deepEqual(await prepare(), { plans: 1, students: 1 });
  assert.deepEqual(await prepare(), { plans: 0, students: 0 });
  const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const [plan] = board.plans,
    [row] = board.placements;
  assert.equal(plan?.sourceClassId, scope.sourceClass.id);
  assert.equal(plan?.sharedStageId, scope.catalog.secondStageId);
  assert.deepEqual(plan?.slots, slots);
  assert.equal(plan?.teacherId, config.teacherId);
  assert.equal(row?.confirmation, "PRECONFIRMED");
  assert.equal(row?.mode, "ADVANCE");
  const result = await caller().semesterOrganization.publish({
    planId: plan.id,
    version: plan.version,
    placements: [{ id: row.id, version: row.version }],
  });
  const published = await db.class.findUniqueOrThrow({ where: { id: result.classId } });
  assert.equal(published.previousClassId, scope.sourceClass.id);
});

void it("restarts provisional placements while keeping real confirmations, marks, scheduled entries and student follow-up", async () => {
  const scope = await fixture();
  const service = caller().semesterOrganization;
  const input = { semesterId: scope.semester.id };
  const pending = await scope.student("Awaiting conversation", false);
  const confirmed = await scope.student("Confirmed a place");
  const preconfirmed = await scope.student("Qualified for automatic confirmation", false);
  const scheduled = await scope.student("Scheduled entry");
  await ownClass(scope);
  for (const student of [confirmed, preconfirmed, scheduled])
    await acquireMaterial(student.id, scope.catalog.firstStageId);
  await seedPassingResults(scope, [preconfirmed, scheduled]);
  await service.publish({
    planId: scope.plan.id,
    version: 1,
    placements: [{ id: scheduled.proposal.id, version: 1 }],
  });
  const oldPreview = await service.resetPreview(input);
  assert.equal(oldPreview.release, 1);
  await service.continuity({
    ...input,
    id: pending.proposal.id,
    version: 1,
    continuity: "UNDECIDED",
    attentionNote: "Retomar contato na sexta-feira.",
  });
  await assert.rejects(
    service.reset({ ...input, fingerprint: oldPreview.fingerprint }),
    (error) => error instanceof TRPCError && error.code === "CONFLICT",
  );
  const preview = await service.resetPreview(input);
  assert.equal(preview.keep, 3);
  const reset = await service.reset({ ...input, fingerprint: preview.fingerprint });
  assert.equal(reset.released, 1);
  const board = await service.detail(input);
  const byStudent = new Map(board.placements.map((row) => [row.studentId, row]));
  const released = byStudent.get(pending.id);
  assert.ok(released);
  assert.equal(released.planId, null);
  assert.equal(released.attentionNote, "Retomar contato na sexta-feira.");
  const kept = byStudent.get(confirmed.id);
  assert.ok(kept);
  assert.equal(kept.attention.attendance, null);
  assert.equal(kept.confirmation, "PRECONFIRMED");
  const automatic = byStudent.get(preconfirmed.id);
  assert.ok(automatic);
  assert.equal(automatic.confirmation, "PRECONFIRMED");
  assert.equal(automatic.planId, scope.plan.id);
  assert.equal(byStudent.get(scheduled.id)?.entryStatus, "SCHEDULED");
  const history = await service.history({ id: pending.proposal.id });
  assert.equal(history[0]?.action, "FORMATION_RESET");
  const afterReset = await service.resetPreview(input);
  assert.equal(afterReset.release, 0);
  await service.prepare(input);
  const refreshed = await service.detail(input);
  assert.equal(refreshed.placements.find((row) => row.id === pending.proposal.id)?.planId, null);
  assert.equal(
    refreshed.placements.find((row) => row.id === preconfirmed.proposal.id)?.planId,
    scope.plan.id,
  );
});

void it("resolves each continuity blocker from its source before scheduling the membership", async () => {
  const scope = await fixture();
  const student = await scope.student("Reposição");
  const service = caller().semesterOrganization;
  const input = { semesterId: scope.semester.id };
  const state = async (): Promise<
    Awaited<ReturnType<FormationCaller["detail"]>>["placements"][number]
  > => {
    const board = await service.detail(input);
    return board.placements[0]!;
  };
  const publish = (): ReturnType<FormationCaller["publish"]> =>
    service.publish({
      planId: scope.plan.id,
      version: 1,
      placements: [{ id: student.proposal.id, version: 1 }],
    });
  await ownClass(scope);
  await seedPassingResults(scope, [student]);
  await db.studentHealthPending.create({
    data: { studentId: student.id, score: 10, evaluatedAt: new Date("2085-05-15") },
  });
  const attendance = await db.attendance.findFirstOrThrow({
    where: { enrollmentId: student.source.enrollment.id },
  });
  await db.attendance.update({ where: { id: attendance.id }, data: { status: "ABSENT" } });
  await db.contract.updateMany({
    where: { studentId: student.id },
    data: { endsOn: new Date("2085-06-30") },
  });
  const initial = await state();
  assert.deepEqual(initial.blockers, [
    "Sem contrato vigente",
    "Material sem compra registrada",
    "Frequência baixa",
  ]);
  await acquireMaterial(student.id, scope.catalog.firstStageId);
  const withMaterial = await state();
  assert.deepEqual(withMaterial.blockers, ["Sem contrato vigente", "Frequência baixa"]);
  await assert.rejects(publish(), /Sem contrato vigente.*Frequência baixa/u);
  await db.contract.updateMany({
    where: { studentId: student.id },
    data: { endsOn: new Date("2085-12-31") },
  });
  const makeup = await db.pedagogicalAppointment.create({
    data: {
      purpose: "MAKEUP",
      teacherId: config.teacherId,
      studentId: student.id,
      enrollmentId: student.source.enrollment.id,
      format: "IN_PERSON",
      date: new Date("2085-05-15"),
      startTime: new Date("1970-01-01T15:00Z"),
      endTime: new Date("1970-01-01T16:00Z"),
      coverages: { create: { attendanceId: attendance.id, minutes: 60 } },
    },
  });
  const blocked = await state();
  assert.equal(blocked.confirmation, "BLOCKED");
  assert.deepEqual(blocked.blockers, ["Frequência baixa"]);
  await assert.rejects(publish(), /Frequência baixa/u);
  await db.pedagogicalAppointment.update({
    where: { id: makeup.id },
    data: {
      status: "ATTENDED",
      performedMinutes: 60,
      recordedAt: new Date("2085-05-15"),
      recordedById: admin.id,
      performedContent: "Reposição da aula",
    },
  });
  const ready = await state();
  assert.deepEqual(ready.blockers, []);
  assert.equal(ready.attention.lowHealth, true);
  assert.equal(ready.confirmation, "PRECONFIRMED");
  assert.equal(ready.publishedAt, null);
  await publish();
  const published = await state();
  assert.equal(published.confirmation, "CONFIRMED");
});

void it("preserves recorded departure when editing the proposal", async () => {
  const scope = await fixture();
  const student = await scope.student("Saída");
  const declinedAt = new Date("2085-05-10");
  await db.semesterPlacement.update({
    where: { id: student.proposal.id },
    data: { declinedAt, declinedReason: "Mudança de cidade" },
  });
  await caller().semesterOrganization.savePlacement({
    id: student.proposal.id,
    version: 1,
    studentId: student.id,
    semesterId: scope.semester.id,
    planId: scope.plan.id,
    mode: "CONTINUE",
    sourceProgressId: student.source.progress.id,
    stageId: scope.catalog.firstStageId,
  });
  const board = await caller().semesterOrganization.detail({ semesterId: scope.semester.id });
  const row = board.placements[0]!;
  assert.deepEqual(row.declinedAt, declinedAt);
  assert.equal(row.declinedReason, "Mudança de cidade");
  assert.equal(row.confirmation, "LEAVING");
});
