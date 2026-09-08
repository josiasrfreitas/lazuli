import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
import {
  ACTIVE_PROGRESS_REQUIRED,
  ACTIVE_STUDENT_TRACK,
  ARCHIVED_CLASS,
  CAPACITY_OVERRIDE_REQUIRED,
  CLOSE_DATE,
  CLOSED_PROGRESS_ABSENT,
  createAndCloseImportedLegacyLifecycle,
  createActiveEnrollmentWithProgress,
  createActiveEnrollmentWithProgressInTransaction,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  type DatabaseClient,
  ENTRY_DATE,
  expectConstraintRejection,
  FIRST_PROGRESS_END_DATE,
  LEGACY_TRACK_BLOCKED,
  OVERLAP_END_DATE,
  OVERLAP_START_DATE,
  PROGRESS_NO_OVERLAP,
  REGULAR_STAGE_MATCH,
  seedCatalog,
  cleanDatabase,
  seedTeacher,
} from "../support/enrollment-progress-schema-support.js";
loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });
const { createDbClient } = await import("../../src/client.js");
void describe("enrollment and pedagogical progress schema", () => {
  const database = createDbClient();
  void before(async () => {
    await database.$connect();
  });
  void beforeEach(async () => {
    await cleanDatabase(database);
    await seedTeacher(database);
  });
  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });
  registerValidActiveEnrollmentTest(database);
  registerSameTrackRejectionTest(database);
  registerDifferentTrackAllowanceTest(database);
  registerMissingProgressRejectionTest(database);
  registerClosedEnrollmentActiveProgressRejectionTest(database);
  registerOverlappingProgressRejectionTest(database);
  registerArchivedClassRejectionTest(database);
  registerLegacyTrackGuardTest(database);
  registerCapacityOverrideTest(database);
  registerRegularStageMatchTest(database);
});
function registerValidActiveEnrollmentTest(database: DatabaseClient): void {
  void it("creates a valid active enrollment with active progress", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Valid Active");
    const classRow = await createPersonalizedClass(database, {
      code: "valid-active",
      capacity: 4,
    });
    const enrollment = await createActiveEnrollmentWithProgress(database, {
      classId: classRow.id,
      stageId: catalog.activeStageId,
      studentId: student.id,
    });
    const progress = await database.pedagogicalProgress.findMany({
      where: { enrollmentId: enrollment.id, endDate: null },
    });
    assert.equal(progress.length, 1);
  });
}
async function advanceToSecondActiveProgress(
  database: DatabaseClient,
  input: {
    enrollmentId: string;
    stageId: string;
  },
): Promise<void> {
  await database.$transaction(async (transaction) => {
    await transaction.pedagogicalProgress.updateMany({
      where: { enrollmentId: input.enrollmentId, endDate: null },
      data: { endDate: FIRST_PROGRESS_END_DATE, endReason: "ADVANCED" },
    });
    await transaction.pedagogicalProgress.create({
      data: { enrollmentId: input.enrollmentId, stageId: input.stageId, startDate: CLOSE_DATE },
    });
  });
}
function registerSameTrackRejectionTest(database: DatabaseClient): void {
  void it("rejects concurrent active enrollments in the same track", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Same Track");
    const firstClass = await createPersonalizedClass(database, {
      code: "same-track-a",
      capacity: 4,
    });
    const secondClass = await createPersonalizedClass(database, {
      code: "same-track-b",
      capacity: 4,
    });
    await createActiveEnrollmentWithProgress(database, {
      classId: firstClass.id,
      stageId: catalog.activeStageId,
      studentId: student.id,
    });
    const observedConstraint1 = await expectConstraintRejection(
      createActiveEnrollmentWithProgress(database, {
        classId: secondClass.id,
        stageId: catalog.activeStageId,
        studentId: student.id,
      }),
      ACTIVE_STUDENT_TRACK,
    );
    assert.equal(observedConstraint1.includes(ACTIVE_STUDENT_TRACK), true);
  });
}
function registerDifferentTrackAllowanceTest(database: DatabaseClient): void {
  void it("allows concurrent active enrollments in different tracks", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Different Tracks");
    const firstClass = await createPersonalizedClass(database, {
      code: "different-track-a",
      capacity: 4,
    });
    const secondClass = await createPersonalizedClass(database, {
      code: "different-track-b",
      capacity: 4,
    });
    await createActiveEnrollmentWithProgress(database, {
      classId: firstClass.id,
      stageId: catalog.activeStageId,
      studentId: student.id,
    });
    await createActiveEnrollmentWithProgress(database, {
      classId: secondClass.id,
      stageId: catalog.secondTrackStageId,
      studentId: student.id,
    });
    const activeEnrollments = await database.enrollment.count({
      where: { studentId: student.id, exitDate: null },
    });
    assert.equal(activeEnrollments, 2);
  });
}
function registerMissingProgressRejectionTest(database: DatabaseClient): void {
  void it("rejects an active enrollment without active progress at commit", async () => {
    const student = await createStudent(database, "No Progress");
    const classRow = await createPersonalizedClass(database, {
      code: "no-progress",
      capacity: 4,
    });
    const observedConstraint2 = await expectConstraintRejection(
      database.enrollment.create({
        data: {
          classId: classRow.id,
          entryDate: ENTRY_DATE,
          studentId: student.id,
        },
      }),
      ACTIVE_PROGRESS_REQUIRED,
    );
    assert.equal(observedConstraint2.includes(ACTIVE_PROGRESS_REQUIRED), true);
  });
}
function registerClosedEnrollmentActiveProgressRejectionTest(database: DatabaseClient): void {
  void it("rejects a closed enrollment that still has active progress", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Closed With Active");
    const classRow = await createPersonalizedClass(database, {
      code: "closed-active-progress",
      capacity: 4,
    });
    const observedConstraint3 = await expectConstraintRejection(
      database.$transaction(async (transaction) => {
        const enrollment = await createActiveEnrollmentWithProgressInTransaction(transaction, {
          classId: classRow.id,
          stageId: catalog.activeStageId,
          studentId: student.id,
        });
        await transaction.enrollment.update({
          where: { id: enrollment.id },
          data: { exitDate: CLOSE_DATE, exitReason: "COMPLETED" },
        });
      }),
      CLOSED_PROGRESS_ABSENT,
    );
    assert.equal(observedConstraint3.includes(CLOSED_PROGRESS_ABSENT), true);
  });
}
function registerOverlappingProgressRejectionTest(database: DatabaseClient): void {
  void it("rejects overlapping progress windows", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Overlap");
    const classRow = await createPersonalizedClass(database, {
      code: "overlap",
      capacity: 4,
    });
    const enrollment = await createActiveEnrollmentWithProgress(database, {
      classId: classRow.id,
      stageId: catalog.activeStageId,
      studentId: student.id,
    });
    await advanceToSecondActiveProgress(database, {
      enrollmentId: enrollment.id,
      stageId: catalog.activeStageId,
    });
    const observedConstraint4 = await expectConstraintRejection(
      database.pedagogicalProgress.create({
        data: {
          enrollmentId: enrollment.id,
          stageId: catalog.activeStageId,
          startDate: OVERLAP_START_DATE,
          endDate: OVERLAP_END_DATE,
          endReason: "CORRECTION",
        },
      }),
      PROGRESS_NO_OVERLAP,
    );
    assert.equal(observedConstraint4.includes(PROGRESS_NO_OVERLAP), true);
  });
}
function registerArchivedClassRejectionTest(database: DatabaseClient): void {
  void it("rejects enrollment into an archived class", async () => {
    const student = await createStudent(database, "Archived Class");
    const classRow = await createPersonalizedClass(database, {
      code: "archived",
      capacity: 4,
      status: "ARCHIVED",
    });
    const observedConstraint5 = await expectConstraintRejection(
      database.enrollment.create({
        data: {
          classId: classRow.id,
          entryDate: ENTRY_DATE,
          studentId: student.id,
        },
      }),
      ARCHIVED_CLASS,
    );
    assert.equal(observedConstraint5.includes(ARCHIVED_CLASS), true);
  });
}
function registerLegacyTrackGuardTest(database: DatabaseClient): void {
  void it("rejects legacy track progress unless the transaction flag is set", async () => {
    const catalog = await seedCatalog(database);
    const firstStudent = await createStudent(database, "Legacy Rejected");
    const secondStudent = await createStudent(database, "Legacy Allowed");
    const rejectedClass = await createPersonalizedClass(database, {
      code: "legacy-rejected",
      capacity: 4,
    });
    const allowedClass = await createPersonalizedClass(database, {
      code: "legacy-allowed",
      capacity: 4,
    });
    const observedConstraint6 = await expectConstraintRejection(
      createActiveEnrollmentWithProgress(database, {
        classId: rejectedClass.id,
        stageId: catalog.legacyStageId,
        studentId: firstStudent.id,
      }),
      LEGACY_TRACK_BLOCKED,
    );
    assert.equal(observedConstraint6.includes(LEGACY_TRACK_BLOCKED), true);
    await createAndCloseImportedLegacyLifecycle(database, {
      classId: allowedClass.id,
      stageId: catalog.legacyStageId,
      studentId: secondStudent.id,
    });
  });
}
function registerCapacityOverrideTest(database: DatabaseClient): void {
  void it("requires a capacity override reason when active enrollment exceeds capacity", async () => {
    const catalog = await seedCatalog(database);
    const firstStudent = await createStudent(database, "Capacity First");
    const secondStudent = await createStudent(database, "Capacity Second");
    const thirdStudent = await createStudent(database, "Capacity Override");
    const classRow = await createPersonalizedClass(database, { code: "capacity", capacity: 1 });
    await createActiveEnrollmentWithProgress(database, {
      classId: classRow.id,
      stageId: catalog.activeStageId,
      studentId: firstStudent.id,
    });
    const observedConstraint7 = await expectConstraintRejection(
      createActiveEnrollmentWithProgress(database, {
        classId: classRow.id,
        stageId: catalog.activeStageId,
        studentId: secondStudent.id,
      }),
      CAPACITY_OVERRIDE_REQUIRED,
    );
    assert.equal(observedConstraint7.includes(CAPACITY_OVERRIDE_REQUIRED), true);
    await createActiveEnrollmentWithProgress(database, {
      capacityOverrideReason: "Manual coordinator approval for sibling schedule.",
      classId: classRow.id,
      stageId: catalog.activeStageId,
      studentId: thirdStudent.id,
    });
  });
}
function registerRegularStageMatchTest(database: DatabaseClient): void {
  void it("requires regular active progress to match the class shared stage", async () => {
    const catalog = await seedCatalog(database);
    const student = await createStudent(database, "Regular Mismatch");
    const classRow = await createRegularClass(database, {
      code: "regular-mismatch",
      sharedStageId: catalog.activeStageId,
    });
    const observedConstraint8 = await expectConstraintRejection(
      createActiveEnrollmentWithProgress(database, {
        classId: classRow.id,
        stageId: catalog.sameTrackSecondStageId,
        studentId: student.id,
      }),
      REGULAR_STAGE_MATCH,
    );
    assert.equal(observedConstraint8.includes(REGULAR_STAGE_MATCH), true);
  });
}
