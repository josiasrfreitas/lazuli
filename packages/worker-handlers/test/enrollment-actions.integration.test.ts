import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import { processDueEnrollmentActions } from "../src/enrollment/process-due-actions.js";

const PREFIX = "Issue 157 worker ";
const TEACHER_ID = "00000000-0000-0000-0000-000000015701";
const ADMIN_ID = "00000000-0000-0000-0000-000000015702";
void before(async () => {
  await db.$connect();
  await clean();
});
void after(async () => {
  await clean();
  await db.$disconnect();
});

void it("applies a scheduled pause on its São Paulo date once, preserving the recorded author", async () => {
  const fixtures = await seed();
  const beforeDate = new Date("2026-10-08T02:59:59.000Z");
  const dueDate = new Date("2026-10-08T03:00:00.000Z");
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: beforeDate })),
    0,
  );
  const enrollmentBefore = await db.enrollment.findUniqueOrThrow({
    where: { id: fixtures.enrollmentId },
  });
  assert.equal(enrollmentBefore.exitDate, null);
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: dueDate })),
    1,
  );
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: dueDate })),
    0,
  );
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: fixtures.enrollmentId },
  });
  const progress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: fixtures.progressId },
  });
  const action = await db.enrollmentAction.findUniqueOrThrow({ where: { id: fixtures.actionId } });
  assert.equal(enrollment.exitDate?.toISOString().slice(0, 10), "2026-10-08");
  assert.equal(enrollment.exitReason, "SUSPENDED");
  assert.equal(progress.endDate?.toISOString().slice(0, 10), "2026-10-08");
  assert.equal(action.status, "APPLIED");
  assert.equal(action.recordedById, ADMIN_ID);
});

async function seed(): Promise<{ enrollmentId: string; progressId: string; actionId: string }> {
  await db.user.createMany({
    data: [
      {
        id: TEACHER_ID,
        email: "issue157-worker-teacher@example.com",
        name: `${PREFIX}Teacher`,
        role: "TEACHER",
        isEnabled: true,
      },
      {
        id: ADMIN_ID,
        email: "issue157-worker-admin@example.com",
        name: `${PREFIX}Admin`,
        role: "ADMIN",
        isEnabled: true,
      },
    ],
  });
  const productLine = await db.productLine.create({
    data: { key: "issue157_worker_line", name: `${PREFIX}Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${PREFIX}Track`, status: "ACTIVE" },
  });
  const stage = await db.stage.create({
    data: { trackId: track.id, name: `${PREFIX}Stage`, internalCode: "ISSUE157WS1", sequence: 1 },
  });
  const semester = await db.semester.create({
    data: {
      name: `${PREFIX}2026.2`,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
    },
  });
  const classRow = await db.class.create({
    data: {
      internalCode: `${PREFIX}Class`,
      portalClassName: `${PREFIX}Portal`,
      teacherId: TEACHER_ID,
      scheduleType: "PERSONALIZED",
      format: "IN_PERSON",
      semesterId: semester.id,
      year: 2026,
      capacity: 2,
    },
  });
  const student = await db.student.create({
    data: { fullName: `${PREFIX}Student`, status: "ACTIVE" },
  });
  return db.$transaction(async (database) => {
    const enrollment = await database.enrollment.create({
      data: { studentId: student.id, classId: classRow.id, entryDate: new Date("2026-07-01") },
    });
    const progress = await database.pedagogicalProgress.create({
      data: { enrollmentId: enrollment.id, stageId: stage.id, startDate: new Date("2026-07-01") },
    });
    const action = await database.enrollmentAction.create({
      data: {
        enrollmentId: enrollment.id,
        kind: "PAUSE",
        status: "SCHEDULED",
        effectiveDate: new Date("2026-10-08"),
        recordedById: ADMIN_ID,
      },
    });
    return { enrollmentId: enrollment.id, progressId: progress.id, actionId: action.id };
  });
}
async function clean(): Promise<void> {
  await db.enrollmentAction.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: PREFIX } } } },
  });
  await db.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: PREFIX } } } },
  });
  await db.enrollment.deleteMany({ where: { student: { fullName: { startsWith: PREFIX } } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.class.deleteMany({ where: { internalCode: { startsWith: PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.stage.deleteMany({ where: { internalCode: "ISSUE157WS1" } });
  await db.track.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.productLine.deleteMany({ where: { key: "issue157_worker_line" } });
  await db.user.deleteMany({ where: { id: { in: [TEACHER_ID, ADMIN_ID] } } });
}
