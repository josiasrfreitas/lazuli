import assert from "node:assert/strict";
import { it, beforeEach, after } from "node:test";
import { db } from "@lazuli/db";
import {
  assessmentCaller,
  assessmentConfig,
  assessmentFixture,
  assessmentTeacher,
  completeGrades,
  ASSESSMENT_DATE,
} from "../support/assessments.js";
import {
  registerDbLifecycle,
  createPersonalizedClassFor,
  createRegularClassFor,
} from "../support/enrollment/fixtures.js";

async function cleanAssessmentRecords(): Promise<void> {
  const where = { student: { fullName: { startsWith: assessmentConfig.prefix } } };
  await db.assessmentGrade.deleteMany({ where: { assessment: where } });
  await db.pedagogicalProgress.updateMany({
    where: { enrollment: where },
    data: { assessmentId: null },
  });
  await db.stageAssessment.deleteMany({ where });
}
beforeEach(cleanAssessmentRecords);
after(cleanAssessmentRecords);
registerDbLifecycle(assessmentConfig);

void it("does not replace the original author or invalidate a confirmed assessment on an unchanged save", async () => {
  const fixture = await assessmentFixture();
  const teacher = assessmentCaller(ASSESSMENT_DATE, assessmentTeacher);
  const saved = await teacher.assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: completeGrades(),
  });
  const confirmed = await assessmentCaller().assessments.confirm({
    progressId: fixture.progressId,
    version: saved.version,
    decision: "APPROVED",
    reason: "Conferido",
  });
  const unchanged = await assessmentCaller().assessments.save({
    progressId: fixture.progressId,
    version: confirmed.version,
    grades: completeGrades(),
  });
  assert.equal(unchanged.version, confirmed.version);
  assert.equal(unchanged.decision, "APPROVED");
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixture.studentId, action: "assessments.save" },
    }),
    1,
  );
  assert.deepEqual(
    unchanged.grades.map((grade) => grade.recordedBy),
    Array.from({ length: 8 }).fill("Assessment Teacher"),
  );
});

void it("restricts teacher access to current responsibility and administrative confirmation", async () => {
  const fixture = await assessmentFixture();
  const teacher = assessmentCaller(ASSESSMENT_DATE, assessmentTeacher);
  const saved = await teacher.assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: completeGrades(),
  });
  assert.equal(saved.canConfirm, false);
  await assert.rejects(
    teacher.assessments.confirm({
      progressId: fixture.progressId,
      version: saved.version,
      decision: "APPROVED",
      reason: "Conferido",
    }),
    { code: "FORBIDDEN" },
  );
  const stranger = assessmentCaller(ASSESSMENT_DATE, {
    ...assessmentTeacher,
    id: "00000000-0000-0000-0000-000000000177",
  });
  await assert.rejects(stranger.assessments.byProgress({ progressId: fixture.progressId }), {
    code: "FORBIDDEN",
  });
  await assert.rejects(stranger.assessments.class({ classId: fixture.classId }), {
    code: "FORBIDDEN",
  });
  await assessmentCaller().enrollment.close({
    enrollmentId: fixture.enrollmentId,
    reason: "SUSPENDED",
  });
  await assert.rejects(teacher.assessments.byProgress({ progressId: fixture.progressId }), {
    code: "FORBIDDEN",
  });
});
void it("serializes corrections to a confirmed result and withdraws approval once", async () => {
  const fixture = await assessmentFixture();
  const caller = assessmentCaller();
  const saved = await caller.assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: completeGrades(),
  });
  const confirmed = await caller.assessments.confirm({
    progressId: fixture.progressId,
    version: saved.version,
    decision: "APPROVED",
    reason: "Conferido pela coordenação",
  });
  const correction = {
    progressId: fixture.progressId,
    version: confirmed.version,
    grades: [{ ...completeGrades()[0]!, score: 50 }],
  };
  await assert.rejects(caller.assessments.save(correction), {
    code: "BAD_REQUEST",
    message: /Justifique a correção/,
  });
  const results = await Promise.allSettled(
    [50, 70].map((score) =>
      caller.assessments.save({
        ...correction,
        correctionReason: "Correção documentada de transcrição",
        grades: [{ ...completeGrades()[0]!, score }],
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const current = await caller.assessments.byProgress({ progressId: fixture.progressId });
  assert.equal(current.version, confirmed.version + 1);
  assert.deepEqual(
    [current.decision, current.confirmedAt, current.confirmedBy],
    [null, null, null],
  );
  assert.equal(
    await db.activityEvent.count({
      where: { subjectId: fixture.studentId, action: "assessments.save" },
    }),
    2,
  );
});

void it("retains one assessment across same-stage transfer and return, then starts empty at a different stage", async () => {
  const fixture = await assessmentFixture();
  const api = assessmentCaller();
  const saved = await api.assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: completeGrades(),
  });
  await api.assessments.confirm({
    progressId: fixture.progressId,
    version: saved.version,
    decision: "APPROVED",
    reason: "Competências conferidas antes da movimentação.",
  });
  const target = await createPersonalizedClassFor(assessmentConfig, {
    code: "same-stage-transfer",
    semesterId: fixture.semesterId,
  });
  const moved = await assessmentCaller("2073-02-16").enrollment.transfer({
    enrollmentId: fixture.enrollmentId,
    targetClassId: target.id,
    entryDate: new Date("2073-02-16"),
  });
  const movedView = await assessmentCaller("2073-02-16").assessments.byProgress({
    progressId: moved.progress.id,
  });
  assert.equal(movedView.assessmentId, saved.assessmentId);
  assert.equal(movedView.decision, "APPROVED");
  assert.deepEqual(
    movedView.grades.map((grade) => `${grade.phase}:${grade.competence}:${grade.score}`).toSorted(),
    completeGrades()
      .map((grade) => `${grade.phase}:${grade.competence}:${grade.score}`)
      .toSorted(),
  );
  await assessmentCaller("2073-02-17").enrollment.close({
    enrollmentId: moved.enrollment.id,
    reason: "SUSPENDED",
  });
  const resumed = await assessmentCaller("2073-02-18").enrollment.return({
    sourceEnrollmentId: moved.enrollment.id,
    targetClassId: fixture.classId,
    stageId: fixture.stageId,
  });
  const returned = await assessmentCaller("2073-02-18").assessments.student({
    studentId: fixture.studentId,
  });
  assert.equal(returned.length, 1);
  assert.equal(returned[0]?.progressId, resumed.progress.id);
  assert.equal(returned[0]?.assessmentId, saved.assessmentId);
  assert.equal(returned[0]?.startedOn, ASSESSMENT_DATE);
  assert.equal(returned[0]?.decision, "APPROVED");
  assert.equal(returned[0]?.grades.length, 8);
  const regular = await createRegularClassFor(assessmentConfig, {
    code: "different-stage-transfer",
    semesterId: fixture.semesterId,
    sharedStageId: fixture.nextStageId,
  });
  const nextStage = await assessmentCaller("2073-02-20").enrollment.transfer({
    enrollmentId: resumed.enrollment.id,
    targetClassId: regular.id,
    entryDate: new Date("2073-02-20"),
  });
  const fresh = await assessmentCaller("2073-02-20").assessments.byProgress({
    progressId: nextStage.progress.id,
  });
  assert.equal(fresh.assessmentId, null);
  assert.deepEqual(fresh.grades, []);
  assert.equal(fresh.decision, null);
  assert.equal(fresh.status, "INCOMPLETE");
  assert.equal(await db.stageAssessment.count({ where: { studentId: fixture.studentId } }), 1);
});
