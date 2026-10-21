import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { createCaller, type StaffUser } from "@lazuli/api";
import { importTeachingProgram } from "../../src/teaching-programs/import.js";
import { programInput } from "../support/teaching-program.js";
import {
  cleanEnrollmentFixtures,
  ensureTeacherFor,
  seedTwoStageCatalogFor,
  createRegularClassFor,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";

const config = {
  prefix: "ProgramCatalog ",
  catalogKey: "program-catalog",
  catalogKeyPrefix: "program-catalog",
  teacherId: "00000000-0000-0000-0000-000000002070",
  teacherEmail: "program-catalog@example.com",
  teacherName: "Program Teacher",
  semesterName: "ProgramCatalog 2075.1",
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
const caller = (staffUser = admin): ReturnType<typeof createCaller> =>
  createCaller({ db, staffUser, now: new Date("2075-02-15T15:00:00Z") });
async function clean(): Promise<void> {
  const stage = { name: { startsWith: config.prefix } };
  const plans = { stage };
  await db.stagePlanRevision.deleteMany({ where: { plan: plans } });
  await db.stagePlanItem.deleteMany({ where: { plan: plans } });
  await db.stagePlan.deleteMany({ where: plans });
  const program = { stage };
  await db.programActivityLesson.deleteMany({ where: { activity: { teachingHour: { program } } } });
  await db.programActivity.deleteMany({ where: { teachingHour: { program } } });
  await db.programAssessment.deleteMany({ where: { program } });
  await db.teachingHour.deleteMany({ where: { program } });
  await db.programUnit.deleteMany({ where: { program } });
  await db.teachingProgram.deleteMany({ where: program });
  await db.bookLesson.deleteMany({ where: { stage } });
  await db.teachingModality.deleteMany({ where: { code: "PROGRAM_TEST_2H" } });
  await db.activityEvent.deleteMany({ where: { subjectName: { startsWith: config.prefix } } });
  await cleanEnrollmentFixtures(config);
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
async function catalog(): Promise<Awaited<ReturnType<typeof seedTwoStageCatalogFor>>> {
  await ensureTeacherFor(config);
  return seedTwoStageCatalogFor(config);
}

void it("imports concurrent retries once and derives actual curriculum counts while keeping pending stages visible", async () => {
  const fixture = await catalog();
  const input = programInput(fixture.firstStageId);
  const imported = await Promise.all([
    importTeachingProgram(db, input),
    importTeachingProgram(db, input),
  ]);
  assert.equal(imported[0].id, imported[1].id);
  assert.deepEqual(imported.map((row) => row.imported).toSorted(), [false, true]);
  const result = await caller().teachingPrograms.detail({ id: fixture.firstStageId });
  assert.ok(result);
  assert.equal(result.lessonCount, 1);
  assert.equal(result?.programs.length, 1);
  const program = result.programs[0]!;
  assert.deepEqual(
    [program.teachingHourCount, program.totalMinutes, program.unitCount, program.assessmentCount],
    [3, 180, 1, 1],
  );
  assert.deepEqual(
    program.units[0]!.teachingHours[0]!.activities.map((row) => [row.kind, row.durationMinutes]),
    [
      ["LESSON", 30],
      ["REVIEW", 30],
    ],
  );
  assert.deepEqual(
    program.units[0]!.teachingHours[0]!.activities[0]!.lessons.map((row) => [
      row.sequence,
      row.title,
      row.part,
    ]),
    [[1, "Conversas", "A"]],
  );
  const second = await caller().teachingPrograms.detail({ id: fixture.secondStageId });
  assert.deepEqual(second?.programs, []);
  assert.equal(second?.lessonCount, null);
  const list = await caller().teachingPrograms.catalog();
  assert.deepEqual(
    list
      .filter((row) => row.track.id === result.track.id)
      .map((row) => [row.id, row._count.teachingPrograms]),
    [
      [fixture.firstStageId, 1],
      [fixture.secondStageId, 0],
    ],
  );
  await assert.rejects(caller({ ...admin, role: "FINANCE" }).teachingPrograms.catalog(), {
    code: "FORBIDDEN",
  });
  await assert.rejects(
    caller({ ...admin, role: "TEACHER", id: config.teacherId }).teachingPrograms.detail({
      id: fixture.firstStageId,
    }),
    { code: "FORBIDDEN" },
  );
});

void it("preserves a revision and its book references and rolls back a conflicting import without retiring the current program", async () => {
  const fixture = await catalog();
  const input = programInput(fixture.firstStageId);
  const original = await importTeachingProgram(db, input);
  const changed = structuredClone(input);
  changed.activities[0]!.title = "Conteúdo substituído";
  await assert.rejects(importTeachingProgram(db, changed), /nova revisão/);
  changed.source.revision = "v2";
  changed.lessons[0]!.title = "Outra edição";
  await assert.rejects(importTeachingProgram(db, changed), /reconciliação explícita/);
  const result = await caller().teachingPrograms.detail({ id: fixture.firstStageId });
  assert.ok(result);
  const program = result.programs[0];
  assert.ok(program);
  assert.equal(program.id, original.id);
  assert.equal(program.source.revision, "v1");
  assert.equal(program.units[0]?.teachingHours[0]?.activities[0]?.title, "Perguntas em duplas");
  assert.equal(result.lessons[0]!.title, "Conversas");
  assert.equal(await db.teachingProgram.count({ where: { stageId: fixture.firstStageId } }), 1);
});

void it("binds canonical content to the same stage and schedule, retains older links after retirement and blocks new links to retired content", async () => {
  const fixture = await catalog();
  const input = programInput(fixture.firstStageId);
  const original = await importTeachingProgram(db, input);
  const group = await createRegularClassFor(config, {
    code: "A",
    semesterId: fixture.semesterId,
    sharedStageId: fixture.firstStageId,
  });
  const detail = await caller().teachingPrograms.detail({ id: fixture.firstStageId });
  const activityId = detail!.programs[0]!.units[0]!.teachingHours[0]!.activities[0]!.id;
  const target = { classId: group.id };
  await caller().planning.saveWindow({
    ...target,
    version: 0,
    plannedStartOn: "2075-02-15",
    plannedEndOn: "2075-06-20",
    objective: null,
  });
  const activity = {
    ...target,
    plannedOn: "2075-02-20",
    kind: "ACTIVITY" as const,
    title: "Título adulterado",
    reference: null,
    pageFrom: null,
    pageTo: null,
  };
  const other = await importTeachingProgram(db, programInput(fixture.secondStageId));
  const foreignActivity = await db.programActivity.findFirstOrThrow({
    where: { programId: other.id },
  });
  await assert.rejects(
    caller().planning.saveItem({ ...activity, version: 1, programActivityId: foreignActivity.id }),
    { code: "BAD_REQUEST", message: /indisponível/ },
  );
  const personalized = structuredClone(input);
  personalized.scheduleType = "PERSONALIZED";
  const ppt = await importTeachingProgram(db, personalized);
  const pptActivity = await db.programActivity.findFirstOrThrow({ where: { programId: ppt.id } });
  await assert.rejects(
    caller().planning.saveItem({ ...activity, version: 1, programActivityId: pptActivity.id }),
    { code: "BAD_REQUEST", message: /indisponível/ },
  );
  await caller().planning.saveItem({ ...activity, version: 1, programActivityId: activityId });
  const initial = await caller().planning.detail(target);
  assert.deepEqual(
    initial.plan?.items.map((row) => [row.programActivityId, row.title, row.kind, row.reference]),
    [[activityId, "Perguntas em duplas", "CONTENT", "Unidade 1 · hora-aula 1"]],
  );
  const newer = structuredClone(input);
  newer.source.revision = "v2";
  newer.activities[0]!.title = "Nova revisão da atividade";
  const revised = await importTeachingProgram(db, newer);
  assert.notEqual(revised.id, original.id);
  const retired = await db.teachingProgram.findUniqueOrThrow({ where: { id: original.id } });
  assert.notEqual(retired.retiredAt, null);
  await caller().planning.saveItem({
    ...activity,
    version: 2,
    itemId: initial.plan.items[0]!.id,
    plannedOn: "2075-02-21",
    reason: "Reorganizar a data mantendo a fonte original.",
  });
  await assert.rejects(
    caller().planning.saveItem({ ...activity, version: 3, programActivityId: activityId }),
    { code: "BAD_REQUEST", message: /indisponível/ },
  );
  const saved = await caller().planning.detail(target);
  assert.ok(saved.plan);
  assert.equal(saved.plan.version, 3);
  assert.equal(saved.plan.items[0]!.programActivityId, activityId);
  assert.equal(saved.plan.items[0]!.title, "Perguntas em duplas");
  const history = await caller().planning.history(target);
  assert.equal(history.items[0]!.snapshot.items[0]!.programActivityId, activityId);
  assert.equal(history.items[0]!.snapshot.items[0]!.plannedOn, "2075-02-21");
  const current = await caller().teachingPrograms.detail({ id: fixture.firstStageId });
  assert.equal(current?.programs.find((row) => row.scheduleType === "REGULAR")?.id, revised.id);
});
