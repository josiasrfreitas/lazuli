import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import {
  cleanEnrollmentFixtures,
  createPersonalizedClassFor,
  createStudentFor,
  ensureTeacherFor,
  seedCatalogFor,
  ENROLLMENT_ADMIN_ID,
} from "../support/enrollment/fixtures.js";

void it("keeps the teacher's signal open across contacts and a financial handoff until the team reassesses it", async (test) => {
  const key = randomUUID().slice(0, 8);
  const config = {
    prefix: `Case ${key} `,
    teacherId: randomUUID(),
    teacherEmail: `${key}@example.test`,
    teacherName: "Professora do caso",
    catalogKey: key,
    catalogKeyPrefix: key,
    semesterName: `Case ${key} 2086.1`,
    semesterStart: "2086-01-01",
    semesterEnd: "2086-06-30",
  };
  const students = { fullName: { startsWith: config.prefix } };
  test.after(async () => {
    await db.semesterPlacementRevision.deleteMany({ where: { placement: { student: students } } });
    await db.semesterPlacement.deleteMany({ where: { student: students } });
    await db.contractRenegotiation.deleteMany({ where: { contract: { student: students } } });
    await db.semesterClassPlan.deleteMany({ where: { name: config.prefix } });
    await cleanEnrollmentFixtures(config);
    await db.$disconnect();
  });
  await ensureTeacherFor(config);
  const { semesterId, activeStageId } = await seedCatalogFor(config);
  const group = await createPersonalizedClassFor(config, { code: "case", semesterId });
  const student = await createStudentFor(config, { suffix: "Acompanhamento" });
  const other = await createStudentFor(config, { suffix: "Outro aluno" });
  const enrollment = await db.enrollment.create({
    include: { progressRecords: true },
    data: {
      studentId: student.id,
      classId: group.id,
      entryDate: new Date("2086-02-01"),
      progressRecords: { create: { stageId: activeStageId, startDate: new Date("2086-02-01") } },
    },
  });
  const plan = await db.semesterClassPlan.create({
    data: {
      semesterId,
      name: config.prefix,
      sourceClassId: group.id,
      format: "IN_PERSON",
      scheduleType: "PERSONALIZED",
      teacherId: config.teacherId,
      slots: [{ weekday: "MONDAY", startTime: "14:00", endTime: "15:00" }],
      recordedById: ENROLLMENT_ADMIN_ID,
    },
  });
  const placement = await db.semesterPlacement.create({
    data: {
      semesterId,
      planId: plan.id,
      studentId: student.id,
      sourceEnrollmentId: enrollment.id,
      sourceProgressId: enrollment.progressRecords[0]!.id,
      mode: "CONTINUE",
      recordedById: ENROLLMENT_ADMIN_ID,
    },
  });
  let tick = Date.parse("2086-02-15T12:00:00Z");
  function session(role: StaffUser["role"], id: string): ReturnType<typeof createCaller> {
    return createCaller({
      db,
      now: new Date(tick++),
      staffUser: { id, role, isEnabled: true, name: role, email: `${role}@example.test` },
    });
  }
  const office = (): ReturnType<typeof createCaller>["semesterOrganization"] =>
    session("ADMIN", ENROLLMENT_ADMIN_ID).semesterOrganization;
  const teacher = session("TEACHER", config.teacherId);
  const target = { id: placement.id, semesterId };
  const signal = {
    ...target,
    eventId: randomUUID(),
    kind: "RISK" as const,
    verbalReport: false,
    narrative: "Deixou de participar das aulas.",
  };
  assert.deepEqual(await office().caseHistory(target), []);
  const note = {
    ...target,
    eventId: randomUUID(),
    kind: "NOTE" as const,
    narrative: "Atendimento da equipe.",
  };
  await assert.rejects(office().recordCase(note), { code: "BAD_REQUEST" });
  const cases = await teacher.teacherWorkspace.formationCases({ studentId: student.id });
  assert.equal(cases[0]!.id, placement.id);
  await assert.rejects(
    session("TEACHER", randomUUID()).teacherWorkspace.signalFormationRisk(signal),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(teacher.semesterOrganization.caseFinance(target), { code: "FORBIDDEN" });
  await teacher.teacherWorkspace.signalFormationRisk(signal);
  await teacher.teacherWorkspace.signalFormationRisk(signal);
  await assert.rejects(
    teacher.teacherWorkspace.signalFormationRisk({ ...signal, narrative: "Outro relato." }),
    { code: "BAD_REQUEST" },
  );
  const afterReload = await teacher.teacherWorkspace.formationCases({ studentId: student.id });
  assert.equal(afterReload[0]!.caseEvents[0]!.narrative, signal.narrative);
  assert.equal(afterReload[0]!.caseEvents[0]!.verbalReport, false);
  const state = (): Promise<typeof placement> =>
    db.semesterPlacement.findUniqueOrThrow({ where: { id: placement.id } });
  const reported = await state();
  assert.equal(reported.exitRiskActive, true);
  const board = await office().detail({ semesterId });
  const signaled = board.placements.find((item) => item.id === placement.id)!;
  assert.equal(signaled.confirmation, "BLOCKED");
  assert.ok(signaled.blockers.includes("Risco de saída"));
  await Promise.all([
    office().recordCase({
      ...target,
      kind: "CONTACT",
      eventId: randomUUID(),
      narrative: "Ligação para a mãe.",
      outcome: "Sem resposta.",
    }),
    office().recordCase({
      ...target,
      kind: "CONTACT",
      eventId: randomUUID(),
      narrative: "Conversa com a família.",
      outcome: "Dificuldade financeira.",
    }),
  ]);
  async function agreementFor(studentId: string): Promise<{ id: string }> {
    const contract = await db.contract.findFirstOrThrow({ where: { studentId } });
    return db.contractRenegotiation.create({
      data: {
        commandId: randomUUID(),
        fingerprint: key,
        contractId: contract.id,
        actorId: ENROLLMENT_ADMIN_ID,
        actorName: "Financeiro",
        effectiveDate: new Date("2086-02-15"),
        newAmountCents: 30000,
        reductionCents: 1000,
        installmentCount: 3,
        reason: "Acordo com a família.",
        snapshot: {},
      },
    });
  }
  const agreement = await agreementFor(student.id);
  const unrelated = await agreementFor(other.id);
  const handoff = {
    ...target,
    kind: "HANDOFF" as const,
    eventId: randomUUID(),
    narrative: "Família pediu desconto.",
    nextOwner: "Financeiro",
    outcome: "Retornar até sexta-feira.",
  };
  await assert.rejects(
    office().recordCase({ ...handoff, reference: { type: "renegotiation", id: unrelated.id } }),
    { code: "BAD_REQUEST" },
  );
  await office().recordCase({ ...handoff, reference: { type: "renegotiation", id: agreement.id } });
  const financeAfterHandoff = await office().caseFinance(target);
  assert.deepEqual(
    financeAfterHandoff.agreements.map((item) => item.id),
    [agreement.id],
  );
  const afterHandoff = await state();
  assert.equal(afterHandoff.exitRiskActive, true);
  for (const reassessment of ["CONTINUES", "CHANGED", "RESOLVED"] as const) {
    const before = await state();
    await office().recordCase({
      ...target,
      eventId: randomUUID(),
      version: before.version,
      kind: "REVIEW",
      reassessment,
      narrative: "A equipe ouviu a família.",
    });
    const reviewed = await state();
    assert.equal(reviewed.exitRiskActive, reassessment !== "RESOLVED");
  }
  const history = await office().caseHistory(target);
  assert.deepEqual(
    history.map((item) => item.kind),
    ["REVIEW", "REVIEW", "REVIEW", "HANDOFF", "CONTACT", "CONTACT", "RISK"],
  );
  assert.equal(history.at(-1)!.recordedBy!.name, config.teacherName);
  assert.equal(history.at(-1)!.verbalReport, false);
  assert.equal(history[3]!.renegotiationId, agreement.id);
  assert.equal(history[3]!.nextOwner, "Financeiro");
  assert.equal(history[5]!.outcome, "Sem resposta.");
  const resolved = await state();
  assert.equal(resolved.declinedAt, null);
  await assert.rejects(office().recordCase(note), { code: "BAD_REQUEST" });
  await office().recordCase({
    ...target,
    eventId: randomUUID(),
    version: resolved.version,
    kind: "SCHEDULE_RISK",
    narrative: "O novo turno interfere nas aulas.",
  });
  const scheduled = await state();
  await office().recordCase({
    ...target,
    eventId: randomUUID(),
    version: scheduled.version,
    kind: "CHANGE_REQUEST",
    outcome: "Horário",
    narrative: "O aluno prefere estudar pela manhã.",
  });
  const requested = await state();
  assert.equal(requested.planId, placement.planId);
  assert.equal(requested.continuity, "CHANGE");
  const original = await db.contract.findFirstOrThrow({ where: { studentId: student.id } });
  const renewal = await db.contract.create({
    data: {
      studentId: student.id,
      renewedFromId: original.id,
      payerId: original.payerId,
      startsOn: new Date("2086-07-01"),
      endsOn: new Date("2086-12-31"),
    },
  });
  await office().recordCase({
    ...target,
    kind: "AGREEMENT",
    narrative: "Renovação negociada pela equipe.",
    eventId: randomUUID(),
    reference: { type: "renewal", id: renewal.id },
  });
  const afterRenewal = await office().caseHistory(target);
  assert.equal(afterRenewal[0]!.renewalId, renewal.id);
  const financeAfterRenewal = await office().caseFinance(target);
  assert.deepEqual(
    financeAfterRenewal.renewals.map((item) => item.id),
    [renewal.id],
  );
  await office().continuity({
    ...target,
    version: requested.version,
    continuity: "LEAVING",
    reason: "Relato registrado anteriormente.",
  });
  const legacyHistory = await office().caseHistory(target);
  const legacy = legacyHistory[0]!;
  assert.equal(legacy.kind, "RISK");
  assert.equal(legacy.narrative, "Relato registrado anteriormente.");
  assert.equal(legacy.verbalReport, null);
});
