import assert from "node:assert/strict";
import { after, before, beforeEach, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import { gre30Enrollment } from "../support/enrollment.js";

const {
  ADMIN,
  cleanDatabase,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  ensureTeacherUser,
  seedCatalog,
} = gre30Enrollment;
const now = new Date("2026-10-08T15:00:00Z");
function caller(): ReturnType<typeof createCaller> {
  return createCaller({ db, staffUser: ADMIN, now });
}

void before(async () => {
  await db.$connect();
});
void beforeEach(async () => {
  await cleanDatabase();
  await ensureTeacherUser();
});
void after(async () => {
  await cleanDatabase();
  await db.$disconnect();
});

void it("rejects a conflicting track enrollment with an actionable Portuguese error", async () => {
  const catalog = await seedCatalog();
  const source = await createPersonalizedClass({
    code: "eligibility-source",
    semesterId: catalog.semesterId,
  });
  const target = await createPersonalizedClass({
    code: "eligibility-target",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Eligibility Conflict" });
  await caller().enrollment.create({
    studentId: student.id,
    classId: source.id,
    stageId: catalog.activeStageId,
  });
  await assert.rejects(
    caller().enrollment.create({
      studentId: student.id,
      classId: target.id,
      stageId: catalog.activeStageId,
    }),
    {
      code: "BAD_REQUEST",
      message:
        "Este aluno já possui matrícula em outra turma da mesma trilha no período informado.",
    },
  );
  assert.equal(await db.enrollment.count({ where: { studentId: student.id } }), 1);
});

void it("offers active students without a conflicting enrollment in the target track", async () => {
  const catalog = await seedCatalog();
  const target = await createRegularClass({
    code: "eligible-target",
    semesterId: catalog.semesterId,
    sharedStageId: catalog.activeStageId,
  });
  const source = await createPersonalizedClass({
    code: "eligible-source",
    semesterId: catalog.semesterId,
  });
  const free = await createStudent({ suffix: "Eligibility Free" });
  const sameClass = await createStudent({ suffix: "Eligibility Same Class" });
  const sameTrack = await createStudent({ suffix: "Eligibility Same Track" });
  const otherTrack = await createStudent({ suffix: "Eligibility Other Track" });
  await createStudent({ suffix: "Eligibility Inactive", status: "INACTIVE" });
  const currentStage = await db.stage.findUniqueOrThrow({
    where: { id: catalog.activeStageId },
    include: { track: true },
  });
  const otherStage = await db.stage.create({
    data: {
      name: "Other stage",
      internalCode: "OTHER",
      sequence: 1,
      track: {
        create: { name: "Eligibility Other", productLineId: currentStage.track.productLineId },
      },
    },
  });
  await caller().enrollment.create({ studentId: sameClass.id, classId: target.id });
  await caller().enrollment.create({
    studentId: sameTrack.id,
    classId: source.id,
    stageId: catalog.activeStageId,
  });
  await caller().enrollment.create({
    studentId: otherTrack.id,
    classId: source.id,
    stageId: otherStage.id,
  });

  const results = await caller().enrollment.searchCandidates({
    classId: target.id,
    query: "Eligibility",
  });
  assert.deepEqual(new Set(results.map((row) => row.id)), new Set([free.id, otherTrack.id]));
  const initialResults = await caller().enrollment.searchCandidates({ classId: target.id });
  assert.deepEqual(
    initialResults.map((row) => row.id),
    [free.id, otherTrack.id],
  );
  const personalized = await caller().enrollment.searchCandidates({
    classId: source.id,
    query: "Eligibility",
    stageId: catalog.activeStageId,
  });
  assert.deepEqual(
    personalized.map((row) => row.id),
    [free.id],
  );
});

void it("offers a student from the scheduled exit date onward and allows the new entry", async () => {
  const catalog = await seedCatalog();
  const source = await createPersonalizedClass({
    code: "eligible-dates-source",
    semesterId: catalog.semesterId,
  });
  const target = await createRegularClass({
    code: "eligible-dates-target",
    semesterId: catalog.semesterId,
    sharedStageId: catalog.activeStageId,
  });
  const student = await createStudent({ suffix: "Eligibility Dates" });
  const created = await caller().enrollment.create({
    studentId: student.id,
    classId: source.id,
    stageId: catalog.activeStageId,
  });
  await caller().enrollment.close({
    enrollmentId: created.enrollment.id,
    reason: "SUSPENDED",
    effectiveDate: new Date("2026-10-15"),
  });
  const beforeExit = await caller().enrollment.searchCandidates({
    classId: target.id,
    query: "Eligibility Dates",
    entryDate: new Date("2026-10-14"),
  });
  const onExit = await caller().enrollment.searchCandidates({
    classId: target.id,
    query: "Eligibility Dates",
    entryDate: new Date("2026-10-15"),
  });
  assert.deepEqual(beforeExit, []);
  assert.deepEqual(
    onExit.map((row) => row.id),
    [student.id],
  );
  const entry = await caller().enrollment.create({
    studentId: student.id,
    classId: target.id,
    entryDate: new Date("2026-10-15"),
  });
  assert.equal(entry.enrollment.entryDate.toISOString(), "2026-10-15T00:00:00.000Z");
  const action = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: created.enrollment.id, kind: "PAUSE" },
  });
  await assert.rejects(caller().enrollment.cancelScheduled({ actionId: action.id }), {
    code: "BAD_REQUEST",
    message: "Este aluno já possui matrícula em outra turma da mesma trilha no período informado.",
  });
});
