import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import { timeStringToDate } from "../../src/classes/time.js";
import { assertNoTeacherConflict } from "../../src/teachers/availability.js";
import {
  cleanEnrollmentFixtures,
  createRegularClassFor,
  ensureTeacherFor,
  seedCatalogFor,
  ENROLLMENT_ADMIN_ID,
  type EnrollmentSuiteConfig,
} from "../support/enrollment/fixtures.js";

const config: EnrollmentSuiteConfig = {
  prefix: "Admissions 168 ",
  catalogKey: "admissions168_line",
  catalogKeyPrefix: "admissions168_",
  teacherId: "00000000-0000-0000-0000-000000000168",
  teacherName: "Admissions Teacher",
  teacherEmail: "admissions168@example.com",
  semesterName: "Admissions 168 2071.1",
  semesterStart: "2071-02-01",
  semesterEnd: "2071-06-30",
};
const beforeLesson = new Date("2071-02-01T12:00:00Z");
function caller(now = beforeLesson): ReturnType<typeof createCaller> {
  return createCaller({
    db,
    now,
    staffUser: {
      id: ENROLLMENT_ADMIN_ID,
      name: "Admissions Admin",
      email: "admissions-admin@example.com",
      role: "ADMIN",
      isEnabled: true,
    },
  });
}
async function clean(): Promise<void> {
  await db.entryVisit.deleteMany({
    where: { candidate: { fullName: { startsWith: config.prefix } } },
  });
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: config.prefix } } });
  await cleanEnrollmentFixtures(config);
}
before(() => db.$connect());
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});

async function scenario(): Promise<{
  id: string;
  classId: string;
  slotId: string;
  stageId: string;
}> {
  await ensureTeacherFor(config);
  const catalog = await seedCatalogFor(config);
  const group = await createRegularClassFor(config, {
    code: "Monday",
    sharedStageId: catalog.activeStageId,
    semesterId: catalog.semesterId,
  });
  const slot = await db.classScheduleSlot.create({
    data: {
      classId: group.id,
      weekday: "MONDAY",
      startTime: timeStringToDate("14:00"),
      endTime: timeStringToDate("15:00"),
    },
  });
  const id = randomUUID();
  await caller().admissions.save({
    id,
    values: {
      fullName: `${config.prefix}Candidate`,
      phone: "11999998888",
      email: null,
      notes: null,
      studentId: null,
      stageId: catalog.activeStageId,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      availableUntil: "2071-06-30",
      availability: [{ weekday: "MONDAY", startTime: "08:00", endTime: "20:00" }],
    },
  });
  return { id, classId: group.id, slotId: slot.id, stageId: catalog.activeStageId };
}

void it("concurrent conversion retries create exactly one student, enrollment and initial progress", async () => {
  const fixture = await scenario();
  const command = {
    id: fixture.id,
    classId: fixture.classId,
    date: "2071-02-02",
    student: {
      mode: "create" as const,
      values: { fullName: `${config.prefix}Converted`, birthDate: new Date("2000-01-01") },
    },
  };
  const [first, retry] = await Promise.all([
    caller().admissions.enroll(command),
    caller().admissions.enroll(command),
  ]);
  assert.deepEqual(retry, first);
  assert.equal(await db.student.count({ where: { fullName: `${config.prefix}Converted` } }), 1);
  assert.equal(await db.enrollment.count({ where: { classId: fixture.classId } }), 1);
  const progress = await db.pedagogicalProgress.findMany({
    where: { enrollmentId: first.enrollmentId },
  });
  assert.deepEqual(
    progress.map((row) => ({ stage: row.stageId, end: row.endDate })),
    [{ stage: fixture.stageId, end: null }],
  );
  const candidate = await caller().admissions.byId({ id: fixture.id });
  assert.equal(candidate.status, "ENROLLED");
  assert.equal(candidate.studentId, first.studentId);
});

void it("trial attendance follows the class meeting and never creates an academic enrollment", async () => {
  const fixture = await scenario();
  const visit = await caller().admissions.schedule({
    id: randomUUID(),
    candidateId: fixture.id,
    date: "2071-02-02",
    meeting: {
      kind: "TRIAL",
      classId: fixture.classId,
      scheduleSlotId: fixture.slotId,
      classSessionId: null,
    },
  });
  const guests = await caller().admissions.guests({
    classId: fixture.classId,
    date: "2071-02-02",
    scheduleSlotId: fixture.slotId,
    classSessionId: null,
  });
  assert.deepEqual(
    guests.map((guest) => guest.candidate.id),
    [fixture.id],
  );
  await assert.rejects(
    caller().admissions.outcome({ id: visit.id, status: "ATTENDED" }),
    /após o início/u,
  );
  await caller(new Date("2071-02-02T18:00:00Z")).admissions.outcome({
    id: visit.id,
    status: "ATTENDED",
    notes: "Participou da aula.",
  });
  const candidate = await caller().admissions.byId({ id: fixture.id });
  assert.equal(candidate.status, "WAITING");
  assert.equal(candidate.enrollmentId, null);
  assert.equal(candidate.visits[0]?.status, "ATTENDED");
  assert.equal(candidate.visits[0]?.startTime, "14:00");
  assert.equal(await db.enrollment.count({ where: { classId: fixture.classId } }), 0);
});

void it("rescheduling is atomic, preserves the previous visit and prevents conflicts in both directions", async () => {
  const fixture = await scenario();
  const meeting = {
    kind: "INTRODUCTION" as const,
    teacherId: config.teacherId,
    startTime: "13:00",
    endTime: "14:00",
    format: "IN_PERSON" as const,
  };
  const first = await caller().admissions.schedule({
    id: randomUUID(),
    candidateId: fixture.id,
    date: "2071-02-02",
    meeting,
  });
  await assert.rejects(
    caller().admissions.schedule({
      id: randomUUID(),
      candidateId: fixture.id,
      previousVisitId: first.id,
      date: "2071-02-02",
      meeting: { ...meeting, startTime: "14:00", endTime: "15:00" },
    }),
    /Conflito com/u,
  );
  assert.equal(
    (await db.entryVisit.findUniqueOrThrow({ where: { id: first.id } })).status,
    "SCHEDULED",
  );
  await assert.rejects(
    db.$transaction((database) =>
      assertNoTeacherConflict({
        database,
        teacherId: config.teacherId,
        from: "2071-02-02",
        through: "2071-02-02",
        slots: [],
        candidateMeetings: [{ date: "2071-02-02", startTime: "13:30", endTime: "14:30" }],
      }),
    ),
    /Conflito com aula introdutória/u,
  );
  const replacement = await caller().admissions.schedule({
    id: randomUUID(),
    candidateId: fixture.id,
    previousVisitId: first.id,
    date: "2071-02-09",
    meeting,
  });
  const previous = await db.entryVisit.findUniqueOrThrow({ where: { id: first.id } });
  const current = await db.entryVisit.findUniqueOrThrow({ where: { id: replacement.id } });
  assert.equal(previous.status, "CANCELLED");
  assert.equal(current.previousVisitId, previous.id);
  assert.equal(current.status, "SCHEDULED");
  await assert.rejects(
    caller().admissions.setStatus({ id: fixture.id, status: "ARCHIVED" }),
    /aulas de entrada pendentes/u,
  );
});
