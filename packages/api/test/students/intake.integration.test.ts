import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import type { RouterInputs } from "@lazuli/api";
import { db } from "@lazuli/db";
import { studentIntakeEnrollSchema } from "@lazuli/validators";
import { enrollNewStudent } from "../../src/students/intake.js";
import { createHarness, defineNamespace } from "../support/attendance-test-support.js";

const harness = createHarness(
  defineNamespace({
    label: "intake207",
    startDate: "2091-02-01",
    endDate: "2091-06-30",
    sessionDate: "2091-03-10",
    afterSessionDate: "2091-04-01",
    adminId: "00000000-0000-0000-0000-000000207900",
    teacherId: "00000000-0000-0000-0000-000000207901",
    otherTeacherId: "00000000-0000-0000-0000-000000207902",
  }),
);
const now = new Date("2091-03-10T15:00:00Z");
async function clean(): Promise<void> {
  const studentWhere = { fullName: { startsWith: harness.ns.prefix } };
  await db.entryVisitAssessment.deleteMany({ where: { visit: { candidate: studentWhere } } });
  await db.undatedStudentIntake.deleteMany({ where: { student: studentWhere } });
  await db.semesterPlacementRevision.deleteMany({
    where: { placement: { student: studentWhere } },
  });
  await db.semesterPlacement.deleteMany({ where: { student: studentWhere } });
  await db.calendarReconciliationRequest.deleteMany({
    where: { semester: { name: harness.ns.prefix + "Next" } },
  });
  await db.period.deleteMany({ where: { name: harness.ns.prefix + "Next" } });
  await db.entryVisit.deleteMany({
    where: { candidate: { fullName: { startsWith: harness.ns.prefix } } },
  });
  await db.admissionCandidate.deleteMany({
    where: { fullName: { startsWith: harness.ns.prefix } },
  });

  await harness.clean();
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
function input(): RouterInputs["students"]["enrollNew"] {
  const leadId = randomUUID();
  return {
    commandId: randomUUID(),
    candidateId: null,
    classId: null,
    stageId: null,
    contract: null,
    allowPending: true,
    student: {
      fullName: `${harness.ns.prefix}Ana`,
      documentType: "RG",
      documentNumber: "RG draft preserved",
      birthDate: new Date("2000-01-01"),
      phone: "11999990000",
    },
    leadRegistration: {
      lead: {
        id: leadId,
        fullName: `${harness.ns.prefix}Ana`,
        phone: "11999990000",
        email: null,
        contactName: null,
        source: null,
        englishExperience: "SOME",
      },
      placement: {
        id: randomUUID(),
        candidateId: leadId,
        teacherId: harness.ns.teacher.id,
        date: "2091-03-11",
        startTime: "14:00",
        endTime: "15:00",
        format: "ONLINE",
      },
      allowPending: false,
    },
  };
}

void it("commits a beginner lead and documented student once and leaves the class pending", async () => {
  const base = await harness.seedBaseScenario();
  const values = input();
  values.leadRegistration!.lead.englishExperience = "NONE";
  values.leadRegistration!.lead.stageId = base.stageId;
  values.leadRegistration!.placement = null;
  values.stageId = base.stageId;
  const caller = harness.caller(undefined, now);
  const first = await caller.students.enrollNew(values);
  const retry = await caller.students.enrollNew(values);
  assert.equal(retry.studentId, first.studentId);
  assert.equal(first.enrollmentId, null);
  const lead = await db.admissionCandidate.findUniqueOrThrow({
    where: { id: values.leadRegistration!.lead.id },
  });
  assert.equal(lead.studentId, first.studentId);
  assert.equal(lead.status, "WAITING");
  assert.equal(lead.stageId, base.stageId);
  assert.equal(
    await db.entryVisit.count({ where: { candidateId: lead.id, status: "SCHEDULED" } }),
    0,
  );
  const student = await db.student.findUniqueOrThrow({ where: { id: first.studentId } });
  assert.equal(student.documentType, "RG");
  assert.equal(student.documentNumber, "RG draft preserved");
  await assert.rejects(
    caller.students.enrollNew({
      ...values,
      student: { ...values.student, fullName: "Changed payload" },
    }),
    /outros dados/u,
  );
  await assert.rejects(
    caller.students.enrollNew({ ...values, commandId: randomUUID() }),
    /identificador de lead já foi utilizado/u,
  );
  assert.equal(await db.student.count({ where: { commandId: values.commandId } }), 1);
});

void it("allows independent intakes to share the calendar while excluding semester edits", async () => {
  const { semesterId } = await harness.seedBaseScenario();
  const values = studentIntakeEnrollSchema.parse({ ...input(), leadRegistration: null });
  await db.$transaction(async (database) => {
    await enrollNewStudent({ database, values, now, recordedById: harness.ns.admin.id });
    const [locks] = await db.$queryRaw<
      Array<{
        scheduleFree: boolean;
        calendarWritable: boolean;
        semesterWritable: boolean;
        calendarReadable: boolean;
        semesterReadable: boolean;
      }>
    >`
      SELECT pg_try_advisory_xact_lock(hashtextextended('lazuli:teaching-schedule', 158)) AS "scheduleFree",
        pg_try_advisory_xact_lock(hashtextextended('formation:undated-intake', 0)) AS "calendarWritable",
        pg_try_advisory_xact_lock(hashtextextended(${`semester-organization:${semesterId}`}, 0)) AS "semesterWritable",
        pg_try_advisory_xact_lock_shared(hashtextextended('formation:undated-intake', 0)) AS "calendarReadable",
        pg_try_advisory_xact_lock_shared(hashtextextended(${`semester-organization:${semesterId}`}, 0)) AS "semesterReadable"
    `;
    assert.deepEqual(locks, {
      scheduleFree: true,
      calendarWritable: false,
      semesterWritable: false,
      calendarReadable: true,
      semesterReadable: true,
    });
  });
});

void it("rolls back nested lead and placement when the final student validation fails", async () => {
  await harness.seedBaseScenario();
  const values = input();
  await assert.rejects(
    harness.caller(undefined, now).students.enrollNew({
      ...values,
      student: { ...values.student, birthDate: new Date("2092-01-01") },
    }),
    /nascimento não pode estar no futuro/u,
  );
  assert.equal(
    await db.admissionCandidate.count({ where: { id: values.leadRegistration!.lead.id } }),
    0,
  );
  assert.equal(
    await db.entryVisit.count({ where: { id: values.leadRegistration!.placement!.id } }),
    0,
  );
  assert.equal(await db.student.count({ where: { commandId: values.commandId } }), 0);
});

void it("keeps a tested lead pending until correction, then carries next-period intake into the academic calendar", async () => {
  const base = await harness.seedBaseScenario(),
    values = input();
  const caller = harness.caller(undefined, now);
  const registration = values.leadRegistration!;
  const lead = await caller.admissions.capture(registration);
  const { leadRegistration: _leadRegistration, ...withoutLead } = values;
  const next = {
    ...withoutLead,
    entryPeriod: "NEXT" as const,
    candidateId: lead.id,
    stageId: base.stageId,
  };
  await assert.rejects(caller.students.enrollNew(next), /nivelamento/u);
  assert.equal(await db.student.count({ where: { commandId: next.commandId } }), 0);
  await db.entryVisit.update({
    where: { id: registration.placement!.id },
    data: {
      status: "ATTENDED",
      assessment: {
        create: {
          bucket: "private",
          key: "test",
          fileName: "test.pdf",
          contentType: "application/pdf",
          byteLength: 12,
          uploadedById: harness.ns.admin.id,
          stageId: base.stageId,
          correctedById: harness.ns.admin.id,
          correctedAt: now,
        },
      },
    },
  });
  await db.admissionCandidate.update({ where: { id: lead.id }, data: { stageId: base.stageId } });
  const result = await caller.students.enrollNew(next);
  assert.equal(result.enrollmentId, null);
  const pending = await caller.students.pendingActions({ id: result.studentId });
  assert.equal(pending.undatedIntake?.stageId, base.stageId);
  const change = {
    action: "period" as const,
    name: harness.ns.prefix + "Next",
    from: "2091-07-01",
    through: "2091-12-31",
  };
  const preview = await caller.calendar.academic.changes.preview(change);
  const period = await caller.calendar.academic.changes.confirm({
    change,
    fingerprint: preview.fingerprint,
    commandId: randomUUID(),
  });
  const board = await caller.semesterOrganization.detail({ semesterId: period.semesterId! });
  assert.equal(board.placements[0]?.studentId, result.studentId);
  assert.equal(board.placements[0]?.planId, null);
  assert.equal(board.placements[0]?.stageId, base.stageId);
  assert.equal(
    await db.undatedStudentIntake.findUnique({ where: { studentId: result.studentId } }),
    null,
  );
});
