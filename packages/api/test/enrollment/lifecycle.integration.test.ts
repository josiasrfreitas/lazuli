import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
  CLASS_ARCHIVED_MESSAGE,
  CLASS_NOT_FOUND_MESSAGE,
  ENROLLMENT_ALREADY_CLOSED_MESSAGE,
  ENROLLMENT_NOT_FOUND_MESSAGE,
  TRANSFER_SAME_CLASS_MESSAGE,
} from "../../src/enrollment/errors.js";
import {
  gre32LifecycleEnrollment,
  type TwoStageCatalog as TwoStageCatalogFixture,
} from "../support/enrollment.js";

const {
  assertActiveStageAndOpenEnrollment,
  assertEnrollmentClosed,
  caller,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  enrollPersonalized,
  enrollRegular,
  ensureTeacherUser,
  rejectionMessage,
  registerLifecycleDbLifecycle,
  seedTwoStageCatalog,
} = gre32LifecycleEnrollment;

async function setup(): Promise<TwoStageCatalogFixture> {
  await ensureTeacherUser();
  return seedTwoStageCatalog();
}

/** Enrolls a fresh PERSONALIZED student at `stageId` and returns the enrollment id. */
async function enrollPersonalizedStudent(input: {
  catalog: TwoStageCatalogFixture;
  code: string;
  name: string;
  stageId: string;
}): Promise<string> {
  const classRow = await createPersonalizedClass({
    code: input.code,
    semesterId: input.catalog.semesterId,
  });
  const student = await createStudent(input.name);
  return enrollPersonalized({
    studentId: student.id,
    classId: classRow.id,
    stageId: input.stageId,
  });
}

/** Asserts a transfer closed the source (`TRANSFERRED`) and opened new active progress at `stageId`. */
async function assertTransferred(input: {
  sourceEnrollmentId: string;
  result: { enrollment: { id: string }; progress: { stageId: string } };
  stageId: string;
}): Promise<void> {
  assert.equal(input.result.progress.stageId, input.stageId);
  await assertEnrollmentClosed({
    enrollmentId: input.sourceEnrollmentId,
    exitReason: "TRANSFERRED",
  });
  await assertActiveStageAndOpenEnrollment({
    enrollmentId: input.result.enrollment.id,
    stageId: input.stageId,
  });
}

void describe("enrollment.close", () => {
  registerLifecycleDbLifecycle();

  registerDropClose();
  registerPauseClose();
  registerCloseNotFound();
  registerCloseAlreadyClosed();
});

void describe("enrollment.transfer", () => {
  registerLifecycleDbLifecycle();

  registerRegularTransfer();
  registerPersonalizedCarry();
  registerTransferSameClass();
  registerTransferArchivedTarget();
  registerTransferClosedSource();
  registerTransferMissingTarget();
  registerTransferCapacity();
});

function registerDropClose(): void {
  void it("drops an enrollment: closes it and its active progress as DROPPED", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "drop",
      name: "Drop Student",
      stageId: catalog.firstStageId,
    });

    const result = await caller().enrollment.close({ enrollmentId, reason: "DROPPED" });

    assert.equal(result.exitReason, "DROPPED");
    await assertEnrollmentClosed({ enrollmentId, exitReason: "DROPPED" });
  });
}

function registerPauseClose(): void {
  void it("pauses an enrollment: closes it and its active progress as SUSPENDED", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "pause",
      name: "Pause Student",
      stageId: catalog.firstStageId,
    });

    const result = await caller().enrollment.close({ enrollmentId, reason: "SUSPENDED" });

    assert.equal(result.exitReason, "SUSPENDED");
    await assertEnrollmentClosed({ enrollmentId, exitReason: "SUSPENDED" });
  });
}

function registerCloseNotFound(): void {
  void it("rejects closing an enrollment that does not exist", async () => {
    await setup();

    assert.equal(
      await rejectionMessage(
        caller().enrollment.close({ enrollmentId: randomUUID(), reason: "DROPPED" }),
      ),
      ENROLLMENT_NOT_FOUND_MESSAGE,
    );
  });
}

function registerCloseAlreadyClosed(): void {
  void it("rejects closing an already-closed enrollment", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "reclose",
      name: "Reclose Student",
      stageId: catalog.firstStageId,
    });
    await caller().enrollment.close({ enrollmentId, reason: "DROPPED" });

    assert.equal(
      await rejectionMessage(caller().enrollment.close({ enrollmentId, reason: "SUSPENDED" })),
      ENROLLMENT_ALREADY_CLOSED_MESSAGE,
    );
  });
}

function registerRegularTransfer(): void {
  void it("moves a REGULAR enrollment, adopting the target class stage", async () => {
    const catalog = await setup();
    const source = await createRegularClass({
      code: "src-reg",
      sharedStageId: catalog.firstStageId,
      semesterId: catalog.semesterId,
    });
    const target = await createRegularClass({
      code: "dst-reg",
      sharedStageId: catalog.secondStageId,
      semesterId: catalog.semesterId,
    });
    const student = await createStudent("Regular Transfer Student");
    const enrollmentId = await enrollRegular({ studentId: student.id, classId: source.id });

    const result = await caller().enrollment.transfer({ enrollmentId, targetClassId: target.id });

    assert.equal(result.source.enrollmentId, enrollmentId);
    await assertTransferred({
      sourceEnrollmentId: enrollmentId,
      result,
      stageId: catalog.secondStageId,
    });
  });
}

function registerPersonalizedCarry(): void {
  void it("moves into a PERSONALIZED class, carrying the current stage forward", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "src-ppt",
      name: "Personalized Transfer Student",
      stageId: catalog.secondStageId,
    });
    const target = await createPersonalizedClass({
      code: "dst-ppt",
      semesterId: catalog.semesterId,
    });

    const result = await caller().enrollment.transfer({ enrollmentId, targetClassId: target.id });

    assert.equal(result.source.enrollmentId, enrollmentId);
    await assertTransferred({
      sourceEnrollmentId: enrollmentId,
      result,
      stageId: catalog.secondStageId,
    });
  });
}

function registerTransferSameClass(): void {
  void it("rejects transferring to the same class", async () => {
    const catalog = await setup();
    const classRow = await createPersonalizedClass({
      code: "same",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent("Same Class Student");
    const enrollmentId = await enrollPersonalized({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.firstStageId,
    });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.transfer({ enrollmentId, targetClassId: classRow.id }),
      ),
      TRANSFER_SAME_CLASS_MESSAGE,
    );
  });
}

function registerTransferArchivedTarget(): void {
  void it("rejects transferring into an archived class", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "arch-src",
      name: "Archived Target Student",
      stageId: catalog.firstStageId,
    });
    const target = await createPersonalizedClass({
      code: "arch-dst",
      semesterId: catalog.semesterId,
      status: "ARCHIVED",
    });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.transfer({ enrollmentId, targetClassId: target.id }),
      ),
      CLASS_ARCHIVED_MESSAGE,
    );
  });
}

function registerTransferClosedSource(): void {
  void it("rejects transferring a closed enrollment", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "closed-src",
      name: "Closed Source Student",
      stageId: catalog.firstStageId,
    });
    const target = await createPersonalizedClass({
      code: "closed-dst",
      semesterId: catalog.semesterId,
    });
    await caller().enrollment.close({ enrollmentId, reason: "DROPPED" });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.transfer({ enrollmentId, targetClassId: target.id }),
      ),
      ENROLLMENT_ALREADY_CLOSED_MESSAGE,
    );
  });
}

function registerTransferMissingTarget(): void {
  void it("rejects transferring to a class that does not exist", async () => {
    const catalog = await setup();
    const enrollmentId = await enrollPersonalizedStudent({
      catalog,
      code: "missing-dst",
      name: "Missing Target Student",
      stageId: catalog.firstStageId,
    });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.transfer({ enrollmentId, targetClassId: randomUUID() }),
      ),
      CLASS_NOT_FOUND_MESSAGE,
    );
  });
}

function registerTransferCapacity(): void {
  void it("requires an override to transfer into a full class, then succeeds", async () => {
    const catalog = await setup();
    const target = await createRegularClass({
      code: "cap-dst",
      sharedStageId: catalog.firstStageId,
      semesterId: catalog.semesterId,
      capacity: 1,
    });
    const filler = await createStudent("Capacity Filler");
    await enrollRegular({ studentId: filler.id, classId: target.id });
    const enrollmentId = await mountCapacitySource(catalog);

    assert.equal(
      await rejectionMessage(
        caller().enrollment.transfer({ enrollmentId, targetClassId: target.id }),
      ),
      CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
    );

    const result = await caller().enrollment.transfer({
      enrollmentId,
      targetClassId: target.id,
      capacityOverrideReason: "Turma cheia, autorizado pela coordenacao.",
    });
    assert.equal(result.progress.stageId, catalog.firstStageId);
  });
}

/** Enrolls a mover into a separate REGULAR class so the capacity test can transfer them out. */
async function mountCapacitySource(catalog: TwoStageCatalogFixture): Promise<string> {
  const source = await createRegularClass({
    code: "cap-src",
    sharedStageId: catalog.secondStageId,
    semesterId: catalog.semesterId,
  });
  const mover = await createStudent("Capacity Mover");
  return enrollRegular({ studentId: mover.id, classId: source.id });
}
