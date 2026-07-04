import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
  CLASS_ARCHIVED_MESSAGE,
  DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
  PERSONALIZED_REQUIRES_STAGE_MESSAGE,
  STUDENT_NOT_ACTIVE_MESSAGE,
} from "../../src/enrollment/errors.js";
import { todayDateOnlyInSaoPaulo } from "../../src/students/date-rules.js";
import {
  caller,
  cleanEnrollmentDatabase,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  ensureTeacherUser,
  expectRejects,
  seedCatalog,
  type CatalogFixture,
} from "./enrollment-test-support.js";

const OVERRIDE_REASON = "Aprovacao manual da coordenacao.";

async function setupCatalog(): Promise<CatalogFixture> {
  await ensureTeacherUser();
  return seedCatalog();
}

void describe("enrollment.create", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanEnrollmentDatabase();
  });
  void after(async () => {
    await cleanEnrollmentDatabase();
    await db.$disconnect();
  });

  registerRegularHappyPath();
  registerPersonalizedHappyPath();
  registerPersonalizedRequiresStage();
  registerCapacityOverride();
  registerInactiveStudentRejected();
  registerArchivedClassRejected();
  registerDuplicateRejected();
  registerEntryDateDefault();
});

function registerRegularHappyPath(): void {
  databaseIt("seeds one active progress at the class shared stage (REGULAR)", async () => {
    const catalog = await setupCatalog();
    const classRow = await createRegularClass({
      code: "regular",
      sharedStageId: catalog.activeStageId,
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Regular Student" });

    const result = await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
    });

    assert.equal(result.orderPromptRequired, true);
    assert.equal(result.progress.stageId, catalog.activeStageId);
    assert.equal(result.progress.startDate.getTime(), result.enrollment.entryDate.getTime());

    const activeProgress = await db.pedagogicalProgress.count({
      where: { enrollmentId: result.enrollment.id, endDate: null },
    });
    assert.equal(activeProgress, 1);
  });
}

function registerPersonalizedHappyPath(): void {
  databaseIt("uses the operator-picked stage (PERSONALIZED)", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({ code: "personalized", semesterId: catalog.semesterId });
    const student = await createStudent({ suffix: "Personalized Student" });

    const result = await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });

    assert.equal(result.progress.stageId, catalog.activeStageId);
    assert.equal(result.orderPromptRequired, true);
  });
}

function registerPersonalizedRequiresStage(): void {
  databaseIt("rejects a PERSONALIZED enrollment without a stage", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({ code: "needs-stage", semesterId: catalog.semesterId });
    const student = await createStudent({ suffix: "No Stage Student" });

    await expectRejects(
      caller().enrollment.create({ studentId: student.id, classId: classRow.id }),
      PERSONALIZED_REQUIRES_STAGE_MESSAGE,
    );
  });
}

function registerCapacityOverride(): void {
  databaseIt("requires an override reason over capacity, then allows it", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "capacity",
      semesterId: catalog.semesterId,
      capacity: 1,
    });
    const [first, second, third] = await Promise.all([
      createStudent({ suffix: "Capacity One" }),
      createStudent({ suffix: "Capacity Two" }),
      createStudent({ suffix: "Capacity Three" }),
    ]);

    await caller().enrollment.create({
      studentId: first.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });
    await expectRejects(
      caller().enrollment.create({
        studentId: second.id,
        classId: classRow.id,
        stageId: catalog.activeStageId,
      }),
      CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
    );

    const overridden = await caller().enrollment.create({
      studentId: third.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
      capacityOverrideReason: OVERRIDE_REASON,
    });
    assert.equal(overridden.enrollment.capacityOverrideReason, OVERRIDE_REASON);
  });
}

function registerInactiveStudentRejected(): void {
  databaseIt("rejects enrolling a non-ACTIVE student", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({ code: "inactive", semesterId: catalog.semesterId });
    const student = await createStudent({ suffix: "Dropped Student", status: "DROPPED" });

    await expectRejects(
      caller().enrollment.create({
        studentId: student.id,
        classId: classRow.id,
        stageId: catalog.activeStageId,
      }),
      STUDENT_NOT_ACTIVE_MESSAGE,
    );
  });
}

function registerArchivedClassRejected(): void {
  databaseIt("rejects enrolling into an archived class", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "archived",
      semesterId: catalog.semesterId,
      status: "ARCHIVED",
    });
    const student = await createStudent({ suffix: "Archived Class Student" });

    await expectRejects(
      caller().enrollment.create({
        studentId: student.id,
        classId: classRow.id,
        stageId: catalog.activeStageId,
      }),
      CLASS_ARCHIVED_MESSAGE,
    );
  });
}

function registerDuplicateRejected(): void {
  databaseIt("rejects a duplicate active enrollment in the same class", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({ code: "duplicate", semesterId: catalog.semesterId });
    const student = await createStudent({ suffix: "Duplicate Student" });

    await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });
    await expectRejects(
      caller().enrollment.create({
        studentId: student.id,
        classId: classRow.id,
        stageId: catalog.activeStageId,
      }),
      DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
    );
  });
}

function registerEntryDateDefault(): void {
  databaseIt("defaults the entry date to today when omitted", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({ code: "entry-date", semesterId: catalog.semesterId });
    const student = await createStudent({ suffix: "Entry Date Student" });

    const result = await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });

    const entryDateOnly = result.enrollment.entryDate.toISOString().slice(0, "yyyy-mm-dd".length);
    assert.equal(entryDateOnly, todayDateOnlyInSaoPaulo());
  });
}
