import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import {
  ADMIN,
  TEACHER,
  OTHER_TEACHER,
  TEST_PREFIX,
  caller,
  ensureDashboardUsers,
  cleanDashboardDatabase,
  seedDashboardCatalog,
  seedClass,
  seedStudent,
  seedSession,
} from "../support/dashboard-test-support.js";

const now = new Date("2085-01-08T15:00:00Z");
const dashboard = caller(ADMIN, now).dashboard;
const added = {
  stage: "",
  first: "",
  second: "",
  classA: "",
  classB: "",
  transferred: "",
  newEnrollment: "",
  payer: "",
};
const date = (day: string): Date => new Date(day);
type EnrollmentFixture = {
  classId: string;
  start: string;
  end?: string;
  reason?: "TRANSFERRED" | "DROPPED";
};
async function enroll(
  studentId: string,
  { classId, start, end, reason = "DROPPED" }: EnrollmentFixture,
): Promise<{ id: string }> {
  return db.enrollment.create({
    data: {
      classId,
      studentId,
      entryDate: date(start),
      ...(end ? { exitDate: date(end), exitReason: reason } : {}),
      progressRecords: {
        create: {
          stageId: added.stage,
          startDate: date(start),
          ...(end ? { endDate: date(end), endReason: reason } : {}),
        },
      },
    },
  });
}
async function student(suffix: string): Promise<string> {
  return seedStudent({ suffix, createdAt: date("2083-01-01") });
}
before(async () => {
  await ensureDashboardUsers();
  const catalog = await seedDashboardCatalog();
  added.stage = catalog.stageId;
  added.first = catalog.semesterId;
  const prior = await db.period.create({
    data: {
      name: TEST_PREFIX + "2083.2",
      startDate: date("2083-07-01"),
      endDate: date("2083-12-20"),
    },
  });
  const second = await db.period.create({
    data: {
      name: TEST_PREFIX + "2084.2",
      startDate: date("2084-07-01"),
      endDate: date("2084-12-20"),
    },
  });
  added.second = second.id;
  const earlyClass = await seedClass({
    code: "Early",
    teacherId: TEACHER.id,
    semesterId: added.first,
    stageId: added.stage,
  });
  added.classA = await seedClass({
    code: "A",
    teacherId: TEACHER.id,
    semesterId: added.second,
    stageId: added.stage,
  });
  added.classB = await seedClass({
    code: "B",
    teacherId: OTHER_TEACHER.id,
    semesterId: added.second,
    stageId: added.stage,
  });
  const priorClass = await seedClass({
    code: "Origin",
    teacherId: TEACHER.id,
    semesterId: prior.id,
    stageId: added.stage,
  });
  const early = await student("Early withdrawal");
  await enroll(early, {
    classId: priorClass,
    start: "2083-07-01",
    end: "2084-02-01",
    reason: "TRANSFERRED",
  });
  await enroll(early, { classId: earlyClass, start: "2084-02-01", end: "2084-02-02" });
  const late = await student("Late withdrawal");
  await enroll(late, { classId: added.classA, start: "2084-07-01", end: "2084-12-20" });
  added.transferred = await student("Internal transfer");
  await enroll(added.transferred, {
    classId: added.classA,
    start: "2084-07-01",
    end: "2084-09-01",
    reason: "TRANSFERRED",
  });
  const transfer = await enroll(added.transferred, { classId: added.classB, start: "2084-09-01" });
  added.newEnrollment = transfer.id;
  const open = await student("Awaiting decision");
  await enroll(open, { classId: added.classA, start: "2084-07-01" });
  const long = await student("Long contract");
  await enroll(long, { classId: added.classA, start: "2084-07-01" });
  for (const studentId of [late, added.transferred, open, long])
    await enroll(studentId, {
      classId: earlyClass,
      start: "2084-02-01",
      end: "2084-07-01",
      reason: "TRANSFERRED",
    });
  await enroll(await student("Incoming pupil"), { classId: added.classA, start: "2084-07-02" });
  const payer = await db.payer.create({ data: { name: TEST_PREFIX + "Analytics payer" } });
  added.payer = payer.id;
  const contract = async (
    studentId: string,
    { end, renewedFromId }: { end: string; renewedFromId?: string },
  ): Promise<{ id: string }> =>
    db.contract.create({
      data: {
        studentId,
        payerId: added.payer,
        endsOn: date(end),
        ...(renewedFromId ? { renewedFromId, agreedOn: date("2085-01-06") } : {}),
      },
    });
  const due = await contract(added.transferred, { end: "2084-08-10" });
  await contract(added.transferred, { end: "2084-10-10" });
  await contract(added.transferred, { end: "2085-08-10", renewedFromId: due.id });
  await contract(open, { end: "2084-09-30" });
  await contract(long, { end: "2086-06-30" });
  await contract(late, { end: "2085-06-30" });
  const confirmed = await seedSession({
    classId: added.classB,
    date: "2084-09-04",
    attendanceConfirmedAt: date("2084-09-04T20:00:00Z"),
  });
  await db.attendance.create({
    data: {
      classSessionId: confirmed,
      enrollmentId: added.newEnrollment,
      status: "PRESENT",
      recordedById: ADMIN.id,
    },
  });
  await seedSession({ classId: added.classB, date: "2084-09-11" });
  await db.admissionCandidate.create({
    data: {
      fullName: TEST_PREFIX + "Waiting",
      email: "waiting@example.test",
      stageId: added.stage,
      scheduleType: "REGULAR",
      allocationPendingAt: now,
      recordedById: ADMIN.id,
    },
  });
  const personal = await db.class.create({
    data: {
      internalCode: TEST_PREFIX + "PPT",
      teacherId: TEACHER.id,
      scheduleType: "PERSONALIZED",
      format: "IN_PERSON",
      semesterId: added.second,
      year: 2084,
      capacity: 1,
      portalClassName: "PPT",
    },
  });
  const incoming = await student("PPT placement");
  const placement = await enroll(incoming, { classId: personal.id, start: "2084-07-15" });
  await db.admissionCandidate.create({
    data: {
      fullName: TEST_PREFIX + "PPT entrant",
      email: "ppt@example.test",
      stageId: added.stage,
      studentId: incoming,
      enrollmentId: placement.id,
      status: "ENROLLED",
      scheduleType: "PERSONALIZED",
      recordedById: ADMIN.id,
    },
  });
});
after(async () => {
  const students = { student: { fullName: { startsWith: TEST_PREFIX } } };
  await db.admissionCandidate.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
  await db.attendance.deleteMany({ where: { enrollment: students } });
  await db.$transaction(async (tx) => {
    await tx.pedagogicalProgress.deleteMany({ where: { enrollment: students } });
    await tx.enrollment.deleteMany({ where: students });
  });
  if (added.payer) {
    await db.contract.deleteMany({ where: { payerId: added.payer, renewedFromId: { not: null } } });
    await db.contract.deleteMany({ where: { payerId: added.payer } });
    await db.payer.delete({ where: { id: added.payer } });
  }
  await cleanDashboardDatabase();
  await db.$disconnect();
});
void it("assigns early and late school exits to the destination semester, regardless of the renewal cutoff", async () => {
  const { rows } = await dashboard.pedagogicalRetention({ group: "school", through: "2084-11-01" });
  const first = rows.find((row) => row.id === added.first)!;
  const second = rows.find((row) => row.id === added.second)!;
  assert.deepEqual([first.previous, first.base, first.exited], [TEST_PREFIX + "2083.2", 1, 1]);
  assert.deepEqual(
    [second.previous, second.base, second.exited, second.entrants],
    [TEST_PREFIX + "2084.1", 4, 1, 2],
  );
  assert.deepEqual([second.both, second.originOnly, second.entrantExits], [4, 0, 0]);
  const { rows: teachers } = await dashboard.pedagogicalRetention({ group: "teacher" });
  const transferred = teachers.find(
    (row) => row.id === added.second && row.groupId === OTHER_TEACHER.id,
  );
  assert.deepEqual([transferred?.base, transferred?.exited, transferred?.transferred], [1, 0, 1]);
});
void it("keeps the original expiry cohort on late renewal and counts each pupil once", async () => {
  const before = await dashboard.pedagogicalRetention({ group: "school", through: "2084-12-20" });
  const after = await dashboard.pedagogicalRetention({ group: "school" });
  const first = before.rows.find((row) => row.id === added.second)!;
  const second = after.rows.find((row) => row.id === added.second)!;
  assert.deepEqual([first.due, first.renewed, second.due, second.renewed], [2, 0, 2, 1]);
});
void it("separates observed zero from missing calls, grades and score", async () => {
  const { groups, weekly } = await dashboard.pedagogicalIndicators({
    periodId: added.second,
    group: "teacher",
  });
  const observed = groups.find((row) => row.id === OTHER_TEACHER.id)!;
  const missing = groups.find((row) => row.id === TEACHER.id)!;
  assert.deepEqual(
    [
      observed.base,
      observed.score.value,
      observed.attendance.value,
      observed.occurrences.value,
      observed.grades.value,
    ],
    [1, 100, 100, 0, null],
  );
  assert.deepEqual([missing.base, missing.score.covered, missing.occurrences.value], [5, 0, null]);
  assert.deepEqual(weekly, [
    { groupId: OTHER_TEACHER.id, week: "2084-09-04", present: 1, marked: 1 },
  ]);
});
void it("keeps the current regular queue independent from historical PPT entries", async () => {
  const { rows, today } = await dashboard.pedagogicalDemand({ periodId: added.first });
  assert.equal(today, "2085-01-08");
  assert.deepEqual(
    rows.find((row) => row.id === added.stage),
    { id: added.stage, label: TEST_PREFIX + "Stage", waiting: 1, unspecified: 0, ppt: 0 },
  );
  const current = await dashboard.pedagogicalDemand({ periodId: added.second });
  assert.deepEqual(
    current.rows.find((row) => row.id === added.stage),
    { id: added.stage, label: TEST_PREFIX + "Stage", waiting: 1, unspecified: 0, ppt: 1 },
  );
});

void it("retains all twenty pupils from the prior semester and reports five entrants separately", async () => {
  const from = await db.period.create({
    data: {
      name: TEST_PREFIX + "2085.1",
      startDate: date("2085-02-01"),
      endDate: date("2085-06-20"),
    },
  });
  const to = await db.period.create({
    data: {
      name: TEST_PREFIX + "2085.2",
      startDate: date("2085-07-01"),
      endDate: date("2085-12-20"),
    },
  });
  const common = { teacherId: TEACHER.id, stageId: added.stage };
  const source = await seedClass({ ...common, code: "Twenty", semesterId: from.id });
  const destination = await seedClass({ ...common, code: "TwentyFive", semesterId: to.id });
  for (let index = 0; index < 25; index++) {
    const id = await student(`Cohort ${index}`);
    if (index < 20)
      await enroll(id, {
        classId: source,
        start: "2085-02-01",
        end: "2085-06-20",
        reason: "TRANSFERRED",
      });
    await enroll(id, { classId: destination, start: "2085-07-01" });
  }
  const { rows } = await caller(ADMIN, date("2085-12-21")).dashboard.pedagogicalRetention({
    group: "school",
  });
  const result = rows.find((row) => row.id === to.id)!;
  assert.deepEqual(
    [result.base, result.base - result.exited - result.pending, result.entrants],
    [20, 20, 5],
  );
  const unresolved = await student("Awaiting new enrollment");
  await enroll(unresolved, { classId: source, start: "2085-02-01" });
  const next = await caller(ADMIN, date("2085-12-21")).dashboard.pedagogicalRetention({
    group: "school",
  });
  const updated = next.rows.find((row) => row.id === to.id)!;
  assert.deepEqual(
    [updated.base, updated.exited, updated.pending, updated.entrants],
    [21, 0, 1, 5],
  );
  await db.contract.create({
    data: {
      payerId: added.payer,
      studentId: unresolved,
      startsOn: from.startDate,
      endsOn: date("2086-12-20"),
    },
  });
  const withContract = await caller(ADMIN, date("2085-12-21")).dashboard.pedagogicalRetention({
    group: "school",
  });
  const covered = withContract.rows.find((row) => row.id === to.id)!;
  assert.deepEqual(
    [covered.base, covered.exited, covered.pending, covered.due],
    [21, 0, 0, updated.due],
  );
});
