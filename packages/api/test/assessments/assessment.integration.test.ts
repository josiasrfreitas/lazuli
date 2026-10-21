import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import {
  assessmentCaller,
  assessmentConfig,
  assessmentFixture,
  assessmentTeacher,
  completeGrades,
  ASSESSMENT_DATE,
} from "../support/assessments.js";
import { createPersonalizedClassFor, registerDbLifecycle } from "../support/enrollment/fixtures.js";

registerDbLifecycle(assessmentConfig);

void it("keeps partial grades incomplete and rejects approval and stage advance without confirmation", async () => {
  const fixture = await assessmentFixture();
  const caller = assessmentCaller();
  const input = { progressId: fixture.progressId, version: 0, grades: [completeGrades()[0]!] };
  const saved = await caller.assessments.save(input);
  assert.equal(saved.status, "INCOMPLETE");
  assert.deepEqual(saved.results[0], {
    competence: "ORAL",
    blockOne: 60,
    blockTwo: null,
    average: null,
    recovery: null,
    effective: null,
    passed: null,
  });
  await assert.rejects(
    caller.assessments.confirm({
      progressId: fixture.progressId,
      version: saved.version,
      decision: "APPROVED",
      reason: "Ainda incompleto",
    }),
    { code: "BAD_REQUEST", message: /Complete as duas unidades/ },
  );
  await assert.rejects(caller.enrollment.advanceStage({ enrollmentId: fixture.enrollmentId }), {
    code: "BAD_REQUEST",
    message: /Confirme a aprovação/,
  });
  const unchanged = await db.pedagogicalProgress.findUniqueOrThrow({
    where: { id: fixture.progressId },
  });
  assert.equal(unchanged.stageId, fixture.stageId);
  assert.equal(unchanged.endDate, null);
});

void it("requires every competence to pass, preserves originals through recovery and records approval separately", async () => {
  const fixture = await assessmentFixture();
  const caller = assessmentCaller();
  const saved = await caller.assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: completeGrades(59.9),
  });
  assert.equal(saved.status, "NEEDS_SUPPORT");
  await assert.rejects(
    caller.assessments.confirm({
      progressId: fixture.progressId,
      version: saved.version,
      decision: "APPROVED",
      reason: "Média geral alta",
    }),
    { code: "BAD_REQUEST", message: /pelo menos 60 em todas/ },
  );
  const recovery = await caller.assessments.save({
    progressId: fixture.progressId,
    version: saved.version,
    grades: [
      {
        phase: "RECOVERY",
        competence: "ORAL",
        score: 60,
        assessedOn: ASSESSMENT_DATE,
        reason: "Revisão e nova avaliação oral",
      },
    ],
  });
  assert.deepEqual(recovery.results[0], {
    competence: "ORAL",
    blockOne: 59.9,
    blockTwo: 59.9,
    average: 59.9,
    recovery: 60,
    effective: 60,
    passed: true,
  });
  assert.equal(recovery.decision, null);
  const confirmed = await caller.assessments.confirm({
    progressId: fixture.progressId,
    version: recovery.version,
    decision: "APPROVED",
    reason: "Todas as competências suficientes após recuperação",
  });
  assert.equal(confirmed.decision, "APPROVED");
  assert.equal(confirmed.confirmedBy, "Enrollment Admin de Teste");
  assert.equal(confirmed.confirmedAt?.toISOString(), "2073-02-15T15:00:00.000Z");
  const advanced = await caller.enrollment.advanceStage({ enrollmentId: fixture.enrollmentId });
  assert.equal(advanced.progress.stageId, fixture.nextStageId);
  assert.equal(advanced.progress.startDate.toISOString(), "2073-02-16T00:00:00.000Z");
});

void it("requires a reason for confirmed corrections, invalidates approval and rejects stale versions", async () => {
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
    reason: "Conferido",
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
  const corrected = await caller.assessments.save({
    ...correction,
    correctionReason: "Correção de transcrição",
  });
  assert.deepEqual(
    [corrected.decision, corrected.confirmedAt, corrected.confirmedBy],
    [null, null, null],
  );
  assert.equal(corrected.results[0]?.effective, 55);
  const history = await db.activityEvent.findMany({
    where: { subjectId: fixture.studentId, action: "assessments.save" },
  });
  const correctionEvent = history.find((event) =>
    event.description?.includes("Correção de transcrição"),
  );
  assert.equal(history.length, 2);
  assert.equal(correctionEvent?.actorName, "Assessment Admin");
  assert.match(
    correctionEvent?.description ?? "",
    /Oral · Unidade 1: 60 em 15\/02\/2073, por Enrollment Admin de Teste → 50 em 15\/02\/2073\./u,
  );
  assert.match(
    correctionEvent?.description ?? "",
    /A confirmação pedagógica anterior foi retirada\./u,
  );
  assert.equal(
    corrected.grades.find((grade) => grade.phase === "BLOCK_ONE" && grade.competence === "ORAL")
      ?.reason,
    "Correção de transcrição",
  );
  await assert.rejects(
    caller.assessments.save({ ...correction, correctionReason: "Tela antiga" }),
    { code: "BAD_REQUEST", message: /alteradas por outra pessoa/ },
  );
  await assert.rejects(
    caller.assessments.confirm({
      progressId: fixture.progressId,
      version: confirmed.version,
      decision: "APPROVED",
      reason: "Tela antiga",
    }),
    { code: "BAD_REQUEST", message: /As notas foram alteradas/ },
  );
  await assert.rejects(caller.enrollment.advanceStage({ enrollmentId: fixture.enrollmentId }), {
    code: "BAD_REQUEST",
    message: /Confirme a aprovação/,
  });
});

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
    Array(8).fill("Assessment Teacher"),
  );
});

void it("continues the same assessment through transfer and pause/return, allowing only new grades to the current teacher", async () => {
  const fixture = await assessmentFixture();
  const first = completeGrades()[0]!;
  const original = await assessmentCaller().assessments.save({
    progressId: fixture.progressId,
    version: 0,
    grades: [first],
  });
  const target = await createPersonalizedClassFor(assessmentConfig, {
    code: "target",
    semesterId: fixture.semesterId,
  });
  const moved = await assessmentCaller("2073-02-16").enrollment.transfer({
    enrollmentId: fixture.enrollmentId,
    targetClassId: target.id,
    entryDate: new Date("2073-02-16"),
  });
  const teacher = assessmentCaller("2073-02-16", assessmentTeacher);
  const continued = await teacher.assessments.save({
    progressId: moved.progress.id,
    version: original.version,
    grades: [first, { ...first, phase: "BLOCK_TWO", score: 70, assessedOn: "2073-02-16" }],
  });
  assert.equal(continued.assessmentId, original.assessmentId);
  assert.equal(continued.startedOn, "2073-02-15");
  assert.equal(continued.results[0]?.effective, 65);
  assert.equal(
    continued.grades.find((grade) => grade.phase === "BLOCK_ONE")?.recordedBy,
    "Enrollment Admin de Teste",
  );
  await assert.rejects(
    teacher.assessments.save({
      progressId: moved.progress.id,
      version: continued.version,
      grades: [{ ...first, score: null }],
    }),
    { code: "BAD_REQUEST", message: /anteriores a este vínculo/ },
  );
  await assessmentCaller("2073-02-16").enrollment.close({
    enrollmentId: moved.enrollment.id,
    reason: "SUSPENDED",
  });
  const returned = await assessmentCaller("2073-02-17").enrollment.return({
    sourceEnrollmentId: moved.enrollment.id,
    targetClassId: target.id,
    stageId: fixture.stageId,
  });
  const read = await assessmentCaller("2073-02-17").assessments.byProgress({
    progressId: returned.progress.id,
  });
  assert.equal(read.assessmentId, original.assessmentId);
  assert.equal(read.results[0]?.effective, 65);
  const history = await assessmentCaller("2073-02-17").assessments.student({
    studentId: fixture.studentId,
  });
  assert.deepEqual(
    history.map((row) => row.progressId),
    [returned.progress.id],
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
  const progress = await teacher.assessments.student({ studentId: fixture.studentId });
  assert.deepEqual(
    progress.map((row) => row.progressId),
    [fixture.progressId],
  );
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
  assert.deepEqual(await stranger.assessments.student({ studentId: fixture.studentId }), []);
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

void it("rejects dates outside the stage and recovery before the two blocks without persisting partial writes", async () => {
  const fixture = await assessmentFixture();
  const caller = assessmentCaller();
  for (const date of ["2073-02-14", "2073-02-16"]) {
    await assert.rejects(
      caller.assessments.save({
        progressId: fixture.progressId,
        version: 0,
        grades: [{ ...completeGrades()[0]!, assessedOn: date }],
      }),
      { code: "BAD_REQUEST", message: /data da avaliação/ },
    );
  }
  await assert.rejects(
    caller.assessments.save({
      progressId: fixture.progressId,
      version: 0,
      grades: [{ ...completeGrades()[0]!, phase: "RECOVERY", reason: "Recuperação prematura" }],
    }),
    { code: "BAD_REQUEST", message: /Registre as duas unidades/ },
  );
  const unchanged = await caller.assessments.byProgress({ progressId: fixture.progressId });
  assert.equal(unchanged.assessmentId, null);
  assert.deepEqual(unchanged.grades, []);
});
