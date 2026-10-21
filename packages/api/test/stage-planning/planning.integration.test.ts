import assert from "node:assert/strict";
import { beforeEach, after, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanEnrollmentFixtures,
  ensureTeacherFor,
  createStudentFor,
  seedTwoStageCatalogFor,
  createPersonalizedClassFor,
  createRegularClassFor,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";
const config = {
  prefix: "Planning180 ",
  catalogKey: "planning180",
  catalogKeyPrefix: "planning180",
  teacherId: "00000000-0000-0000-0000-000000001800",
  teacherEmail: "planning180@example.com",
  teacherName: "Planning Teacher",
  semesterName: "Planning180 2075.1",
  semesterStart: "2075-02-01",
  semesterEnd: "2075-06-30",
};
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  role: "ADMIN",
  name: "Coordenação",
  email: "admin@example.com",
  isEnabled: true,
};
const teacher: StaffUser = {
  ...admin,
  id: config.teacherId,
  role: "TEACHER",
  name: config.teacherName,
};
const caller = (day = "2075-02-15", staffUser = admin): ReturnType<typeof createCaller> =>
  createCaller({ db, staffUser, now: new Date(`${day}T15:00:00Z`) });
async function clean(): Promise<void> {
  const group = { internalCode: { startsWith: config.prefix } };
  await db.classSessionRecordRevision.deleteMany({
    where: { record: { classSession: { class: group } } },
  });
  await db.classSessionRecord.deleteMany({ where: { classSession: { class: group } } });
  // Isolate cleanup by this suite's plans, including plans whose original enrollment has ended.
  const plans = await db.stagePlan.findMany({
    where: {
      createdById: { in: [config.teacherId, admin.id] },
      stage: { name: { startsWith: config.prefix } },
    },
    select: { id: true },
  });
  const ids = plans.map((plan) => plan.id);
  await db.pedagogicalProgress.updateMany({
    where: { stagePlanId: { in: ids } },
    data: { stagePlanId: null },
  });
  await db.stagePlanRevision.deleteMany({ where: { planId: { in: ids } } });
  await db.stagePlanItem.deleteMany({ where: { planId: { in: ids } } });
  await db.stagePlan.deleteMany({ where: { id: { in: ids } } });
  await db.activityEvent.deleteMany({ where: { subjectName: { startsWith: config.prefix } } });
  await cleanEnrollmentFixtures(config);
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
type Fixture = {
  catalog: Awaited<ReturnType<typeof seedTwoStageCatalogFor>>;
  group:
    | Awaited<ReturnType<typeof createRegularClassFor>>
    | Awaited<ReturnType<typeof createPersonalizedClassFor>>;
  student: Awaited<ReturnType<typeof createStudentFor>>;
  enrollment: Awaited<ReturnType<ReturnType<typeof createCaller>["enrollment"]["create"]>>;
  target: { classId: string; progressId?: string };
};
async function fixture(regular = false): Promise<Fixture> {
  await ensureTeacherFor(config);
  const catalog = await seedTwoStageCatalogFor(config);
  const group = regular
    ? await createRegularClassFor(config, {
        code: "A",
        semesterId: catalog.semesterId,
        sharedStageId: catalog.firstStageId,
      })
    : await createPersonalizedClassFor(config, { code: "A", semesterId: catalog.semesterId });
  const student = await createStudentFor(config, { suffix: "Ana" });
  const enrollment = await caller().enrollment.create({
    studentId: student.id,
    classId: group.id,
    ...(regular ? {} : { stageId: catalog.firstStageId }),
  });
  return {
    catalog,
    group,
    student,
    enrollment,
    target: { classId: group.id, ...(regular ? {} : { progressId: enrollment.progress.id }) },
  };
}
const dates = {
  plannedStartOn: "2075-02-15",
  plannedEndOn: "2075-06-20",
  objective: "Conversar sobre a rotina.",
};
const activity = {
  plannedOn: "2075-02-20",
  kind: "REVIEW" as const,
  title: "Revisão oral em duplas",
  reference: null,
  pageFrom: null,
  pageTo: null,
};
void it("bounds a regular plan to the semester and allows page-free review without completing academic progress", async () => {
  const fixtureData = await fixture(true);
  await assert.rejects(
    caller().planning.saveWindow({
      ...fixtureData.target,
      ...dates,
      plannedEndOn: "2076-01-10",
      version: 0,
    }),
    { code: "BAD_REQUEST", message: /dentro do semestre/ },
  );
  await caller().planning.saveWindow({ ...fixtureData.target, ...dates, version: 0 });
  await caller().planning.saveItem({ ...fixtureData.target, ...activity, version: 1 });
  await assert.rejects(
    caller().planning.saveItem({
      ...fixtureData.target,
      ...activity,
      plannedOn: "2075-07-01",
      version: 2,
    }),
    { code: "BAD_REQUEST", message: /dentro do período/ },
  );
  await assert.rejects(
    caller().planning.saveItem({
      ...fixtureData.target,
      ...activity,
      pageFrom: 20,
      pageTo: 19,
      version: 2,
    }),
    { code: "BAD_REQUEST" },
  );
  const detail = await caller().planning.detail(fixtureData.target);
  assert.equal(detail.plan?.items.length, 1);
  assert.deepEqual(
    [detail.plan?.items[0]?.kind, detail.plan?.items[0]?.pageFrom, detail.plan?.items[0]?.pageTo],
    ["REVIEW", null, null],
  );
  const progress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: fixtureData.enrollment.progress.id },
  });
  assert.equal(progress.endDate, null);
  assert.equal(progress.stageId, fixtureData.catalog.firstStageId);
  assert.equal(progress.startDate.toISOString(), "2075-02-15T00:00:00.000Z");
});
void it("preserves original intention, removed item identity and attributed revisions while rejecting stale writes atomically", async () => {
  const fixtureData = await fixture();
  await caller().planning.saveWindow({
    ...fixtureData.target,
    ...dates,
    version: 0,
    plannedEndOn: "2076-01-30",
  });
  await caller().planning.saveItem({ ...fixtureData.target, ...activity, version: 1 });
  const initialPlan = await caller().planning.detail(fixtureData.target);
  const itemId = initialPlan.plan!.items[0]!.id;
  await caller("2075-02-16", teacher).planning.saveItem({
    ...fixtureData.target,
    ...activity,
    kind: "ACTIVITY",
    title: "Entrevistas sobre a rotina",
    version: 2,
    itemId,
    reason: "Mais prática de perguntas abertas.",
  });
  await assert.rejects(
    caller().planning.removeItem({
      ...fixtureData.target,
      itemId,
      version: 2,
      reason: "Tela antiga.",
    }),
    { code: "CONFLICT" },
  );
  const history = await caller().planning.history({ ...fixtureData.target, direction: "forward" });
  assert.deepEqual(
    history.items.map((row) => row.version),
    [3, 2, 1],
  );
  assert.equal(history.items[1]?.snapshot.items[0]?.title, "Revisão oral em duplas");
  assert.equal(history.items[0]?.snapshot.items[0]?.title, "Entrevistas sobre a rotina");
  assert.equal(history.items[0]?.recordedBy, config.teacherName);
  assert.equal(history.items[0]?.createdAt.toISOString(), "2075-02-16T15:00:00.000Z");
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixtureData.student.id, action: { startsWith: "planning." } },
    }),
    3,
  );
  await caller("2075-02-17").planning.removeItem({
    ...fixtureData.target,
    itemId,
    version: 3,
    reason: "Atividade redistribuída para o próximo roteiro.",
  });
  const removedPlan = await caller().planning.detail(fixtureData.target);
  assert.deepEqual(removedPlan.plan?.items, []);
  const retiredItem = await db.stagePlanItem.findUniqueOrThrow({
    where: { id: itemId, deletedAt: { not: null } },
  });
  assert.equal(retiredItem.deletedAt?.toISOString(), "2075-02-17T15:00:00.000Z");
});
void it("carries the same individual plan through transfer, pause and return, without extending its deadline", async () => {
  const fixtureData = await fixture();
  const plan = await caller().planning.saveWindow({ ...fixtureData.target, ...dates, version: 0 });
  await caller().planning.saveItem({ ...fixtureData.target, ...activity, version: 1 });
  const groupB = await createPersonalizedClassFor(config, {
    code: "B",
    semesterId: fixtureData.catalog.semesterId,
  });
  const moved = await caller("2075-02-16").enrollment.transfer({
    enrollmentId: fixtureData.enrollment.enrollment.id,
    targetClassId: groupB.id,
    entryDate: new Date("2075-02-16"),
  });
  const movedPlan = await caller("2075-02-16").planning.detail({
    classId: groupB.id,
    progressId: moved.progress.id,
  });
  assert.equal(movedPlan.plan?.id, plan.id);
  await caller("2075-02-17").enrollment.close({
    enrollmentId: moved.enrollment.id,
    reason: "SUSPENDED",
  });
  const returned = await caller("2075-02-19").enrollment.return({
    sourceEnrollmentId: moved.enrollment.id,
    targetClassId: fixtureData.group.id,
    stageId: fixtureData.catalog.firstStageId,
  });
  const resumed = await caller("2075-02-19").planning.detail({
    classId: fixtureData.group.id,
    progressId: returned.progress.id,
  });
  assert.equal(resumed.plan?.id, plan.id);
  assert.equal(resumed.plan?.plannedEndOn, "2075-06-20");
  assert.equal(resumed.plan?.items[0]?.title, "Revisão oral em duplas");
  const nextStageClass = await createRegularClassFor(config, {
    code: "next",
    semesterId: fixtureData.catalog.semesterId,
    sharedStageId: fixtureData.catalog.secondStageId,
  });
  const next = await caller("2075-02-20").enrollment.transfer({
    enrollmentId: returned.enrollment.id,
    targetClassId: nextStageClass.id,
    entryDate: new Date("2075-02-20"),
  });
  const advancedProgress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: next.progress.id },
  });
  assert.equal(advancedProgress.stagePlanId, null);
});
void it("restricts the plan to its class owner and rejects financial access and cross-class progress IDs", async () => {
  const fixtureData = await fixture();
  await caller("2075-02-15", teacher).planning.saveWindow({
    ...fixtureData.target,
    ...dates,
    version: 0,
  });
  const outsider = { ...teacher, id: "00000000-0000-0000-0000-000000001801" };
  await assert.rejects(caller("2075-02-15", outsider).planning.detail(fixtureData.target), {
    code: "FORBIDDEN",
  });
  await assert.rejects(
    caller("2075-02-15", { ...admin, role: "FINANCE" }).planning.detail(fixtureData.target),
    { code: "FORBIDDEN" },
  );
  const groupB = await createPersonalizedClassFor(config, {
    code: "B",
    semesterId: fixtureData.catalog.semesterId,
  });
  await assert.rejects(
    caller().planning.detail({
      classId: groupB.id,
      progressId: fixtureData.enrollment.progress.id,
    }),
    { code: "NOT_FOUND" },
  );
  const authorizedPlan = await caller("2075-02-15", teacher).planning.detail(fixtureData.target);
  assert.equal(authorizedPlan.plan?.version, 1);
});

void it("closes the old plan for editing on the actual advance day and starts the next stage without borrowing it", async () => {
  const fixtureData = await fixture();
  await caller().planning.saveWindow({ ...fixtureData.target, ...dates, version: 0 });
  const advanced = await caller().enrollment.advanceStage({
    enrollmentId: fixtureData.enrollment.enrollment.id,
  });
  const previous = await caller().planning.detail(fixtureData.target);
  assert.equal(previous.scope.readOnly, true);
  assert.equal(previous.plan?.plannedEndOn, "2075-06-20");
  await assert.rejects(
    caller().planning.saveWindow({
      ...fixtureData.target,
      ...dates,
      version: 1,
      reason: "Alteração tardia do roteiro.",
    }),
    { code: "BAD_REQUEST", message: /somente para consulta/ },
  );
  const next = await caller("2075-02-16").planning.detail({
    classId: fixtureData.group.id,
    progressId: advanced.progress.id,
  });
  assert.equal(next.plan, null);
  assert.equal(next.scope.stage.id, fixtureData.catalog.secondStageId);
  const stageHistory = await caller().planning.history(fixtureData.target);
  assert.equal(stageHistory.items.length, 1);
});

void it("retains performed content across a same-stage transfer even when the plan was created after the encounter", async () => {
  const fixtureData = await fixture();
  const session = await db.classSession.create({
    data: {
      classId: fixtureData.group.id,
      date: new Date("2075-02-15"),
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T10:00:00Z"),
    },
  });
  const account = {
    kind: "CONTENT" as const,
    account: "Praticamos perguntas em duplas antes de preparar o roteiro.",
    reference: null,
    pageFrom: null,
    pageTo: null,
  };
  await caller().classRecords.save({
    sessionId: session.id,
    version: 0,
    attendanceStamp: null,
    sharedContent: null,
    note: null,
    rows: [
      { enrollmentId: fixtureData.enrollment.enrollment.id, status: "PRESENT", content: account },
    ],
  });
  const recorded = await caller().classRecords.detail({ sessionId: session.id });
  assert.equal(recorded.snapshot.entries[0]?.planned, null);
  const plan = await caller("2075-02-16").planning.saveWindow({
    ...fixtureData.target,
    ...dates,
    version: 0,
  });
  const destination = await createPersonalizedClassFor(config, {
    code: "B",
    semesterId: fixtureData.catalog.semesterId,
  });
  const moved = await caller("2075-02-17").enrollment.transfer({
    enrollmentId: fixtureData.enrollment.enrollment.id,
    targetClassId: destination.id,
    entryDate: new Date("2075-02-17"),
  });
  const after = await caller("2075-02-17").planning.detail({
    classId: destination.id,
    progressId: moved.progress.id,
  });
  assert.equal(after.plan?.id, plan.id);
  assert.deepEqual(
    after.records.map((row) => ({ id: row.id, account: row.content.account })),
    [{ id: session.id, account: account.account }],
  );
});
