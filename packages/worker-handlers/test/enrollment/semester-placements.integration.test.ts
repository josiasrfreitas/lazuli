import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { processDueEnrollmentActions } from "../../src/enrollment/process-due-actions.js";
const PREFIX = "Semester185Worker ";
const ADMIN = "00000000-0000-0000-0000-000000185001";
const TEACHER = "00000000-0000-0000-0000-000000185002";
const due = new Date("2094-07-01T03:00:00.000Z");
const slots = [{ weekday: "MONDAY" as const, startTime: "14:00", endTime: "15:00" }];
async function clean() {
  const semesters = await db.semester.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = semesters.map((row) => row.id);
  await db.semesterPlacementRevision.deleteMany({
    where: { placement: { semesterId: { in: ids } } },
  });
  await db.semesterPlacement.deleteMany({ where: { semesterId: { in: ids } } });
  await db.studentAvailability.deleteMany({ where: { semesterId: { in: ids } } });
  await db.semesterClassPlan.deleteMany({ where: { semesterId: { in: ids } } });
  await db.enrollmentAction.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: PREFIX } } } },
  });
  await db.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: PREFIX } } } },
  });
  await db.enrollment.deleteMany({ where: { student: { fullName: { startsWith: PREFIX } } } });
  await db.student.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.classScheduleSlot.deleteMany({ where: { class: { semesterId: { in: ids } } } });
  await db.class.deleteMany({ where: { semesterId: { in: ids } } });
  await db.semester.deleteMany({ where: { id: { in: ids } } });
  await db.stage.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.track.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.productLine.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.activityEvent.deleteMany({ where: { subjectName: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { id: { in: [ADMIN, TEACHER] } } });
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
async function fixture() {
  await db.user.createMany({
    data: [
      {
        id: ADMIN,
        name: PREFIX + "Admin",
        email: "semester185worker-admin@example.com",
        role: "ADMIN",
      },
      {
        id: TEACHER,
        name: PREFIX + "Teacher",
        email: "semester185worker-teacher@example.com",
        role: "TEACHER",
      },
    ],
  });
  const line = await db.productLine.create({
    data: { key: "semester185worker", name: PREFIX + "Line" },
  });
  const track = await db.track.create({ data: { name: PREFIX + "Track", productLineId: line.id } });
  const stage = await db.stage.create({
    data: { trackId: track.id, internalCode: "W1", name: PREFIX + "Stage", sequence: 1 },
  });
  const old = await db.semester.create({
    data: {
      name: PREFIX + "2094.1",
      startDate: new Date("2094-01-01"),
      endDate: new Date("2094-06-30"),
    },
  });
  const next = await db.semester.create({
    data: {
      name: PREFIX + "2094.2",
      startDate: new Date("2094-07-01"),
      endDate: new Date("2094-12-31"),
    },
  });
  const makeClass = (semesterId: string, key: string) =>
    db.class.create({
      data: {
        semesterId,
        teacherId: TEACHER,
        scheduleType: "PERSONALIZED",
        format: "ONLINE",
        year: 2094,
        capacity: 25,
        internalCode: PREFIX + key,
        portalClassName: PREFIX + key,
        scheduleSlots: {
          create: [
            {
              weekday: "MONDAY",
              startTime: new Date("1970-01-01T14:00:00Z"),
              endTime: new Date("1970-01-01T15:00:00Z"),
            },
          ],
        },
      },
    });
  const sourceClass = await makeClass(old.id, "source");
  const targetClass = await makeClass(next.id, "target");
  const student = await db.student.create({ data: { fullName: PREFIX + "Student" } });
  const plan = await db.semesterClassPlan.create({
    data: {
      semesterId: next.id,
      name: PREFIX + "Plan",
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      teacherId: TEACHER,
      slots,
      classId: targetClass.id,
      recordedById: ADMIN,
    },
  });
  const availability = await db.studentAvailability.create({
    data: {
      studentId: student.id,
      semesterId: next.id,
      formats: ["ONLINE"],
      slots,
      validUntil: next.endDate,
      recordedById: ADMIN,
      createdAt: new Date("2094-06-01"),
    },
  });
  return db.$transaction(async (database) => {
    const source = await database.enrollment.create({
      data: { studentId: student.id, classId: sourceClass.id, entryDate: old.startDate },
    });
    const sourceProgress = await database.pedagogicalProgress.create({
      data: { enrollmentId: source.id, stageId: stage.id, startDate: old.startDate },
    });
    const exit = await database.enrollmentAction.create({
      data: {
        enrollmentId: source.id,
        kind: "EXIT",
        status: "SCHEDULED",
        exitReason: "TRANSFERRED",
        effectiveDate: next.startDate,
        recordedById: ADMIN,
      },
    });
    const target = await database.enrollment.create({
      data: {
        studentId: student.id,
        classId: targetClass.id,
        entryDate: next.startDate,
        progressRecords: { create: { stageId: stage.id, startDate: next.startDate } },
      },
    });
    const entry = await database.enrollmentAction.create({
      data: {
        enrollmentId: target.id,
        sourceEnrollmentId: source.id,
        kind: "ENTRY",
        status: "SCHEDULED",
        effectiveDate: next.startDate,
        recordedById: ADMIN,
      },
    });
    const placement = await database.semesterPlacement.create({
      data: {
        semesterId: next.id,
        studentId: student.id,
        planId: plan.id,
        trackId: track.id,
        stageId: stage.id,
        mode: "CONTINUE",
        sourceEnrollmentId: source.id,
        sourceProgressId: sourceProgress.id,
        recordedById: ADMIN,
        publishedAt: new Date("2094-06-02"),
        publishedById: ADMIN,
        enrollmentId: target.id,
        entryActionId: entry.id,
        sourceExitActionId: exit.id,
        availabilityId: availability.id,
      },
    });
    return { source, sourceProgress, target, entry, exit, placement, student, next };
  });
}
void it("applies the paired next-semester movement as TRANSFERRED once, only on its school-local effective date", async () => {
  const data = await fixture();
  assert.equal(
    await db.$transaction((database) =>
      processDueEnrollmentActions({ database, now: new Date("2094-07-01T02:59:59Z") }),
    ),
    0,
  );
  const source = await db.enrollment.findUniqueOrThrow({ where: { id: data.source.id } });
  assert.equal(source.exitDate, null);
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: due })),
    2,
  );
  const transferred = await db.enrollment.findUniqueOrThrow({ where: { id: data.source.id } });
  assert.equal(transferred.exitReason, "TRANSFERRED");
  const progress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: data.sourceProgress.id },
  });
  assert.equal(progress.endReason, "TRANSFERRED");
  const entry = await db.enrollmentAction.findUniqueOrThrow({ where: { id: data.entry.id } });
  assert.equal(entry.status, "APPLIED");
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: due })),
    0,
  );
});
void it("returns a publication with invalidated availability to review and preserves the current membership", async () => {
  const data = await fixture();
  await db.studentAvailability.create({
    data: {
      studentId: data.student.id,
      semesterId: data.next.id,
      confirmed: false,
      formats: ["ONLINE"],
      slots,
      validUntil: data.next.endDate,
      notes: "Availability revoked after publication",
      recordedById: ADMIN,
      createdAt: new Date("2094-06-30"),
    },
  });
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: due })),
    0,
  );
  const source = await db.enrollment.findUniqueOrThrow({ where: { id: data.source.id } });
  assert.equal(source.exitDate, null);
  const progress = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: data.sourceProgress.id },
  });
  assert.equal(progress.endDate, null);
  assert.equal(await db.enrollment.count({ where: { id: data.target.id } }), 0);
  const actions = await db.enrollmentAction.findMany({
    where: { id: { in: [data.entry.id, data.exit.id] } },
  });
  assert.deepEqual(
    actions.map((action) => action.status),
    ["CANCELLED", "CANCELLED"],
  );
  const placement = await db.semesterPlacement.findUniqueOrThrow({
    where: { id: data.placement.id },
  });
  assert.equal(placement.publishedAt, null);
  const history = await db.semesterPlacementRevision.findFirstOrThrow({
    where: { placementId: data.placement.id },
  });
  assert.equal(history.action, "REQUIRES_REVIEW");
  assert.equal(history.recordedById, null);
  assert.match(history.reason ?? "", /Confirme a disponibilidade/u);
});

void it("keeps a published exit and entry atomic when the movement straddles the due-action batch boundary", async () => {
  const data = await fixture();
  const students = await db.student.createManyAndReturn({
    data: Array.from({ length: 99 }, (unused, index) => ({ fullName: `${PREFIX}Batch ${index}` })),
  });
  const enrollments = await db.enrollment.createManyAndReturn({
    data: students.map((student) => ({
      studentId: student.id,
      classId: data.target.classId,
      entryDate: data.next.startDate,
    })),
  });
  await db.enrollmentAction.createMany({
    data: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      kind: "ENTRY",
      status: "SCHEDULED",
      effectiveDate: data.next.startDate,
      createdAt: new Date("2094-06-01"),
      recordedById: ADMIN,
    })),
  });
  await db.enrollmentAction.update({
    where: { id: data.exit.id },
    data: { createdAt: new Date("2094-06-02") },
  });
  await db.enrollmentAction.update({
    where: { id: data.entry.id },
    data: { createdAt: new Date("2094-06-03") },
  });

  const count = await db.$transaction(
    (database) => processDueEnrollmentActions({ database, now: due }),
    { timeout: 30_000 },
  );
  assert.equal(count, 101);
  const pair = await db.enrollmentAction.findMany({
    where: { id: { in: [data.entry.id, data.exit.id] } },
  });
  assert.deepEqual(
    pair.map((action) => action.status),
    ["APPLIED", "APPLIED"],
  );
  assert.equal(
    await db.$transaction((database) => processDueEnrollmentActions({ database, now: due })),
    0,
  );
  assert.equal(await db.enrollment.count({ where: { id: data.target.id } }), 1);
  const source = await db.enrollment.findUniqueOrThrow({ where: { id: data.source.id } });
  assert.equal(source.exitReason, "TRANSFERRED");
  assert.equal(
    await db.semesterPlacementRevision.count({
      where: { placementId: data.placement.id, action: "REQUIRES_REVIEW" },
    }),
    0,
  );
});
