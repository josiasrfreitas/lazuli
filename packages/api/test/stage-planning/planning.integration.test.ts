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
const caller = (day = "2075-02-15", staffUser = admin) =>
  createCaller({ db, staffUser, now: new Date(`${day}T15:00:00Z`) });
async function clean(): Promise<void> {
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
async function fixture(regular = false) {
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
  const f = await fixture(true);
  await assert.rejects(
    caller().planning.saveWindow({ ...f.target, ...dates, plannedEndOn: "2076-01-10", version: 0 }),
    { code: "BAD_REQUEST", message: /dentro do semestre/ },
  );
  await caller().planning.saveWindow({ ...f.target, ...dates, version: 0 });
  await caller().planning.saveItem({ ...f.target, ...activity, version: 1 });
  await assert.rejects(
    caller().planning.saveItem({ ...f.target, ...activity, plannedOn: "2075-07-01", version: 2 }),
    { code: "BAD_REQUEST", message: /dentro do período/ },
  );
  await assert.rejects(
    caller().planning.saveItem({ ...f.target, ...activity, pageFrom: 20, pageTo: 19, version: 2 }),
    { code: "BAD_REQUEST" },
  );
  const detail = await caller().planning.detail(f.target);
  assert.equal(detail.plan?.items.length, 1);
  assert.deepEqual(
    [detail.plan?.items[0]?.kind, detail.plan?.items[0]?.pageFrom, detail.plan?.items[0]?.pageTo],
    ["REVIEW", null, null],
  );
  const progress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: f.enrollment.progress.id },
  });
  assert.equal(progress.endDate, null);
  assert.equal(progress.assessmentId, null);
  assert.equal(progress.startDate.toISOString(), "2075-02-15T00:00:00.000Z");
});
void it("preserves original intention, removed item identity and attributed revisions while rejecting stale writes atomically", async () => {
  const f = await fixture();
  await caller().planning.saveWindow({
    ...f.target,
    ...dates,
    version: 0,
    plannedEndOn: "2076-01-30",
  });
  await caller().planning.saveItem({ ...f.target, ...activity, version: 1 });
  const itemId = (await caller().planning.detail(f.target)).plan!.items[0]!.id;
  await caller("2075-02-16", teacher).planning.saveItem({
    ...f.target,
    ...activity,
    kind: "ACTIVITY",
    title: "Entrevistas sobre a rotina",
    version: 2,
    itemId,
    reason: "Mais prática de perguntas abertas.",
  });
  await assert.rejects(
    caller().planning.removeItem({ ...f.target, itemId, version: 2, reason: "Tela antiga." }),
    { code: "CONFLICT" },
  );
  const history = await caller().planning.history({ ...f.target, direction: "forward" });
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
      where: { subjectId: f.student.id, action: { startsWith: "planning." } },
    }),
    3,
  );
  await caller("2075-02-17").planning.removeItem({
    ...f.target,
    itemId,
    version: 3,
    reason: "Atividade redistribuída para o próximo roteiro.",
  });
  assert.deepEqual((await caller().planning.detail(f.target)).plan?.items, []);
  assert.equal(
    (await db.stagePlanItem.findUniqueOrThrow({ where: { id: itemId } })).deletedAt?.toISOString(),
    "2075-02-17T15:00:00.000Z",
  );
});
void it("carries the same individual plan through transfer, pause and return, without extending its deadline", async () => {
  const f = await fixture();
  const plan = await caller().planning.saveWindow({ ...f.target, ...dates, version: 0 });
  await caller().planning.saveItem({ ...f.target, ...activity, version: 1 });
  const groupB = await createPersonalizedClassFor(config, {
    code: "B",
    semesterId: f.catalog.semesterId,
  });
  const moved = await caller("2075-02-16").enrollment.transfer({
    enrollmentId: f.enrollment.enrollment.id,
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
    targetClassId: f.group.id,
    stageId: f.catalog.firstStageId,
  });
  const resumed = await caller("2075-02-19").planning.detail({
    classId: f.group.id,
    progressId: returned.progress.id,
  });
  assert.equal(resumed.plan?.id, plan.id);
  assert.equal(resumed.plan?.plannedEndOn, "2075-06-20");
  assert.equal(resumed.plan?.items[0]?.title, "Revisão oral em duplas");
  const nextStageClass = await createRegularClassFor(config, {
    code: "next",
    semesterId: f.catalog.semesterId,
    sharedStageId: f.catalog.secondStageId,
  });
  const next = await caller("2075-02-20").enrollment.transfer({
    enrollmentId: returned.enrollment.id,
    targetClassId: nextStageClass.id,
    entryDate: new Date("2075-02-20"),
  });
  assert.equal(
    (await db.pedagogicalProgress.findUniqueOrThrow({ where: { id: next.progress.id } }))
      .stagePlanId,
    null,
  );
});
void it("restricts the plan to its class owner and rejects financial access and cross-class progress IDs", async () => {
  const f = await fixture();
  await caller("2075-02-15", teacher).planning.saveWindow({ ...f.target, ...dates, version: 0 });
  const outsider = { ...teacher, id: "00000000-0000-0000-0000-000000001801" };
  await assert.rejects(caller("2075-02-15", outsider).planning.detail(f.target), {
    code: "FORBIDDEN",
  });
  await assert.rejects(
    caller("2075-02-15", { ...admin, role: "FINANCE" }).planning.detail(f.target),
    { code: "FORBIDDEN" },
  );
  const groupB = await createPersonalizedClassFor(config, {
    code: "B",
    semesterId: f.catalog.semesterId,
  });
  await assert.rejects(
    caller().planning.detail({ classId: groupB.id, progressId: f.enrollment.progress.id }),
    { code: "NOT_FOUND" },
  );
  assert.equal((await caller("2075-02-15", teacher).planning.detail(f.target)).plan?.version, 1);
});

void it("closes the old plan for editing on the actual advance day and starts the next stage without borrowing it", async () => {
  const f = await fixture();
  await caller().planning.saveWindow({ ...f.target, ...dates, version: 0 });
  const grades = (["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"] as const).flatMap(
    (competence) =>
      (["BLOCK_ONE", "BLOCK_TWO"] as const).map((phase) => ({
        competence,
        phase,
        score: 80,
        assessedOn: "2075-02-15",
        reason: null,
      })),
  );
  const assessment = await caller().assessments.save({
    progressId: f.enrollment.progress.id,
    version: 0,
    grades,
  });
  await caller().assessments.confirm({
    progressId: f.enrollment.progress.id,
    version: assessment.version,
    decision: "APPROVED",
    reason: "Competências suficientes para o próximo estágio.",
  });
  const advanced = await caller().enrollment.advanceStage({
    enrollmentId: f.enrollment.enrollment.id,
  });
  const previous = await caller().planning.detail(f.target);
  assert.equal(previous.scope.readOnly, true);
  assert.equal(previous.plan?.plannedEndOn, "2075-06-20");
  await assert.rejects(
    caller().planning.saveWindow({
      ...f.target,
      ...dates,
      version: 1,
      reason: "Alteração tardia do roteiro.",
    }),
    { code: "BAD_REQUEST", message: /contexto está encerrado/ },
  );
  const next = await caller("2075-02-16").planning.detail({
    classId: f.group.id,
    progressId: advanced.progress.id,
  });
  assert.equal(next.plan, null);
  assert.equal(next.scope.stage.id, f.catalog.secondStageId);
  assert.equal((await caller().planning.history(f.target)).items.length, 1);
});
