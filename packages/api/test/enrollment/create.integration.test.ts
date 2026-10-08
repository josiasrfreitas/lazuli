import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomUUID } from "node:crypto";

import { db } from "@lazuli/db";

import {
  CLASS_ARCHIVED_MESSAGE,
  DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
  PERSONALIZED_REQUIRES_STAGE_MESSAGE,
  STUDENT_NOT_ACTIVE_MESSAGE,
} from "../../src/enrollment/errors.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import { gre30Enrollment, type CatalogFixture } from "../support/enrollment.js";

const {
  caller,
  cleanDatabase: cleanEnrollmentDatabase,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  ensureTeacherUser,
  rejectionMessage,
  seedCatalog,
} = gre30Enrollment;

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
  registerCapacityInformative();
  registerInactiveStudentRejected();
  registerStudentNotFound();
  registerArchivedClassRejected();
  registerDuplicateRejected();
  registerEntryDateDefault();
});

function registerRegularHappyPath(): void {
  void it("seeds one active progress at the class shared stage (REGULAR)", async () => {
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

function registerStudentNotFound(): void {
  void it("rejects enrollment when the student does not exist", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "missing-student",
      semesterId: catalog.semesterId,
    });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.create({
          studentId: randomUUID(),
          classId: classRow.id,
          stageId: catalog.activeStageId,
        }),
      ),
      "Aluno nao encontrado.",
    );
  });
}

function registerPersonalizedHappyPath(): void {
  void it("uses the operator-picked stage (PERSONALIZED)", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "personalized",
      semesterId: catalog.semesterId,
    });
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
  void it("rejects a PERSONALIZED enrollment without a stage", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "needs-stage",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "No Stage Student" });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.create({ studentId: student.id, classId: classRow.id }),
      ),
      PERSONALIZED_REQUIRES_STAGE_MESSAGE,
    );
  });
}

function registerCapacityInformative(): void {
  void it("allows a class to exceed capacity without an override reason", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "capacity",
      semesterId: catalog.semesterId,
      capacity: 1,
    });
    const [first, second] = await Promise.all([
      createStudent({ suffix: "Capacity One" }),
      createStudent({ suffix: "Capacity Two" }),
    ]);

    await caller().enrollment.create({
      studentId: first.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });
    const overCapacity = await caller().enrollment.create({
      studentId: second.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });
    assert.equal(overCapacity.enrollment.capacityOverrideReason, null);
    assert.equal(await db.enrollment.count({ where: { classId: classRow.id } }), 2);
  });
}

function registerInactiveStudentRejected(): void {
  void it("rejects enrolling a non-ACTIVE student", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "inactive",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Dropped Student", status: "DROPPED" });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.create({
          studentId: student.id,
          classId: classRow.id,
          stageId: catalog.activeStageId,
        }),
      ),
      STUDENT_NOT_ACTIVE_MESSAGE,
    );
  });
}

function registerArchivedClassRejected(): void {
  void it("rejects enrolling into an archived class", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "archived",
      semesterId: catalog.semesterId,
      status: "ARCHIVED",
    });
    const student = await createStudent({ suffix: "Archived Class Student" });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.create({
          studentId: student.id,
          classId: classRow.id,
          stageId: catalog.activeStageId,
        }),
      ),
      CLASS_ARCHIVED_MESSAGE,
    );
  });
}

function registerDuplicateRejected(): void {
  void it("rejects a duplicate active enrollment in the same class", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "duplicate",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Duplicate Student" });

    await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });
    assert.equal(
      await rejectionMessage(
        caller().enrollment.create({
          studentId: student.id,
          classId: classRow.id,
          stageId: catalog.activeStageId,
        }),
      ),
      DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
    );
  });
}

function registerEntryDateDefault(): void {
  void it("defaults the entry date to today when omitted", async () => {
    const catalog = await setupCatalog();
    const classRow = await createPersonalizedClass({
      code: "entry-date",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Entry Date Student" });

    const result = await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.activeStageId,
    });

    const entryDateOnly = result.enrollment.entryDate.toISOString().slice(0, "yyyy-mm-dd".length);
    assert.equal(entryDateOnly, saoPauloDateOnly(new Date()));
  });
}
