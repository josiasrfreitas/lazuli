import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  ADVANCE_REQUIRES_PERSONALIZED_MESSAGE,
  END_OF_TRACK_MESSAGE,
  ENROLLMENT_NOT_ACTIVE_MESSAGE,
  ENROLLMENT_NOT_FOUND_MESSAGE,
} from "../../src/enrollment/errors.js";
import {
  gre31AdvanceEnrollment,
  type TwoStageCatalog as TwoStageCatalogFixture,
} from "../support/enrollment.js";

const {
  assertActiveStageAndOpenEnrollment,
  caller,
  closeEnrollment,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  enrollAtStage,
  ensureTeacherUser,
  rejectionMessage,
  registerAdvanceDbLifecycle,
  seedTwoStageCatalog,
  savePassingAssessment,
} = gre31AdvanceEnrollment;

async function setup(): Promise<TwoStageCatalogFixture> {
  await ensureTeacherUser();
  return seedTwoStageCatalog();
}

void describe("enrollment.advanceStage", () => {
  registerAdvanceDbLifecycle();

  registerHappyPath();
  registerEndOfTrack();
  registerRegularRejected();
  registerNotFound();
  registerClosedEnrollmentRejected();
});

function registerHappyPath(): void {
  void it("requires confirmed approval before advancing, keeps enrollment open and starts fresh assessment scope", async () => {
    const catalog = await setup();
    const classRow = await createPersonalizedClass("happy", catalog.semesterId);
    const student = await createStudent("Happy Student");
    const enrollmentId = await enrollAtStage({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.firstStageId,
    });

    await assert.rejects(caller().enrollment.advanceStage({ enrollmentId }), {
      code: "BAD_REQUEST",
      message: /Confirme a aprovação pedagógica/,
    });
    const saved = await savePassingAssessment(enrollmentId);
    await assert.rejects(caller().enrollment.advanceStage({ enrollmentId }), {
      code: "BAD_REQUEST",
      message: /Confirme a aprovação pedagógica/,
    });
    await caller().assessments.confirm({
      progressId: saved.progressId,
      version: saved.version,
      decision: "APPROVED",
      reason: "Todas as competências atingiram o corte de 60.",
    });
    const result = await caller().enrollment.advanceStage({ enrollmentId });

    assert.equal(result.progress.stageId, catalog.secondStageId);
    assert.equal(result.previousProgress.stageId, catalog.firstStageId);
    const next = await caller().assessments.byProgress({ progressId: result.progress.id });
    assert.equal(next.assessmentId, null);
    assert.deepEqual(next.grades, []);
    const previous = await caller().assessments.byProgress({ progressId: saved.progressId });
    assert.equal(previous.assessmentId, saved.assessmentId);
    assert.equal(previous.decision, "APPROVED");
    await assertActiveStageAndOpenEnrollment({ enrollmentId, stageId: catalog.secondStageId });

    const closed = await db.pedagogicalProgress.findMany({
      where: { enrollmentId, endDate: { not: null } },
      select: { stageId: true, endReason: true },
    });
    assert.equal(closed.length, 1);
    assert.equal(closed[0]?.stageId, catalog.firstStageId);
    assert.equal(closed[0]?.endReason, "ADVANCED");
  });
}

function registerEndOfTrack(): void {
  void it("rejects advancing past the last stage in the track", async () => {
    const catalog = await setup();
    const classRow = await createPersonalizedClass("end-of-track", catalog.semesterId);
    const student = await createStudent("End Of Track Student");
    const enrollmentId = await enrollAtStage({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.secondStageId,
    });

    assert.equal(
      await rejectionMessage(caller().enrollment.advanceStage({ enrollmentId })),
      END_OF_TRACK_MESSAGE,
    );
  });
}

function registerRegularRejected(): void {
  void it("rejects advancing a REGULAR enrollment", async () => {
    const catalog = await setup();
    const classRow = await createRegularClass({
      code: "regular",
      sharedStageId: catalog.firstStageId,
      semesterId: catalog.semesterId,
    });
    const student = await createStudent("Regular Student");
    // REGULAR derives its stage from the class; enrolling with an explicit stageId is rejected.
    const created = await caller().enrollment.create({
      studentId: student.id,
      classId: classRow.id,
    });

    assert.equal(
      await rejectionMessage(
        caller().enrollment.advanceStage({ enrollmentId: created.enrollment.id }),
      ),
      ADVANCE_REQUIRES_PERSONALIZED_MESSAGE,
    );
  });
}

function registerNotFound(): void {
  void it("rejects when the enrollment does not exist", async () => {
    await setup();

    assert.equal(
      await rejectionMessage(caller().enrollment.advanceStage({ enrollmentId: randomUUID() })),
      ENROLLMENT_NOT_FOUND_MESSAGE,
    );
  });
}

function registerClosedEnrollmentRejected(): void {
  void it("rejects advancing a closed enrollment", async () => {
    const catalog = await setup();
    const classRow = await createPersonalizedClass("closed", catalog.semesterId);
    const student = await createStudent("Closed Student");
    const enrollmentId = await enrollAtStage({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.firstStageId,
    });
    await closeEnrollment(enrollmentId);

    assert.equal(
      await rejectionMessage(caller().enrollment.advanceStage({ enrollmentId })),
      ENROLLMENT_NOT_ACTIVE_MESSAGE,
    );
  });
}
