import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import type { RouterInputs } from "@lazuli/api";
import { db } from "@lazuli/db";
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
async function clean() {
  await db.entryVisit.deleteMany({
    where: { candidate: { fullName: { startsWith: harness.ns.prefix } } },
  });
  await db.admissionCandidate.deleteMany({
    where: { fullName: { startsWith: harness.ns.prefix } },
  });
  await db.studentAvailability.deleteMany({
    where: { student: { fullName: { startsWith: harness.ns.prefix } } },
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
        date: "2091-03-11",
        startTime: "14:00",
        endTime: "15:00",
        format: "ONLINE",
      },
      allowPending: false,
    },
  };
}

void it("commits a nested lead, placement and documented student once at final confirmation", async () => {
  await harness.seedBaseScenario();
  const values = input();
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
  assert.equal(lead.stageId, null);
  assert.equal(
    await db.entryVisit.count({ where: { candidateId: lead.id, status: "SCHEDULED" } }),
    1,
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
