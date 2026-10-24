import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import {
  caller,
  ADMIN,
  TEACHER,
  TEST_PREFIX,
  cleanDashboardDatabase,
  ensureDashboardUsers,
  seedClass,
  seedDashboardCatalog,
  seedSession,
  seedStudent,
} from "../support/dashboard-test-support.js";

const NOW = new Date("2084-03-10T18:00:00Z"); // 15:00 school time; fixtures end at 16:00.
async function cleanHomeEnrollments(): Promise<void> {
  const where = { student: { fullName: { startsWith: TEST_PREFIX } } };
  await db.$transaction(async (transaction) => {
    await transaction.pedagogicalProgress.deleteMany({ where: { enrollment: where } });
    await transaction.enrollment.deleteMany({ where });
  });
}
void beforeEach(async () => {
  await cleanHomeEnrollments();
  await cleanDashboardDatabase();
  await ensureDashboardUsers();
});
void after(async () => {
  await cleanHomeEnrollments();
  await cleanDashboardDatabase();
  await db.$disconnect();
});

void it("lists only active undeleted students and keeps pagination counts exact", async () => {
  const before = await caller(ADMIN, NOW).dashboard.pending({ kind: "students", page: 1 });
  const ids: string[] = [];
  for (let index = 0; index < 13; index++)
    ids.push(await seedStudent({ suffix: `Home ${index}`, createdAt: NOW }));
  await seedStudent({ suffix: "Home inactive", status: "INACTIVE", createdAt: NOW });
  const removed = await seedStudent({ suffix: "Home removed", createdAt: NOW });
  await db.student.update({ where: { id: removed }, data: { deletedAt: NOW } });
  const result = await caller(ADMIN, NOW).dashboard.pending({ kind: "students", page: 1 });
  assert.equal(result.total, before.total + 13);
  assert.equal(result.items.length, 12);
  const last = await caller(ADMIN, NOW).dashboard.pending({
    kind: "students",
    page: Math.ceil(result.total / 12),
  });
  assert.equal(last.total, result.total);
  assert.equal(
    last.items.some((row) => row.id === removed),
    false,
  );
  assert.equal(
    result.items.some((row) => row.title.includes("inactive")),
    false,
  );
  const own = [...result.items, ...last.items].find((row) => ids.includes(row.id));
  assert.ok(own);
  assert.deepEqual(own.action, { kind: "link", href: `/alunos/${own.id}` });
});
void it("treats upcoming membership as allocated, and ended membership as needing a class", async () => {
  const catalog = await seedDashboardCatalog();
  const classId = await seedClass({ code: "Home Enrollment", teacherId: TEACHER.id, ...catalog });
  const studentId = await seedStudent({ suffix: "Home enrollment", createdAt: NOW });
  const enrollment = await db.enrollment.create({
    data: {
      studentId,
      classId,
      entryDate: new Date("2084-04-01"),
      progressRecords: { create: { stageId: catalog.stageId, startDate: new Date("2084-04-01") } },
    },
  });
  const future = await caller(ADMIN, NOW).dashboard.pending({ kind: "students", page: 1 });
  assert.equal(
    future.items.some((item) => item.id === studentId),
    false,
  );
  await db.$transaction(async (transaction) => {
    await transaction.enrollment.update({
      where: { id: enrollment.id },
      data: { entryDate: new Date("2084-02-01") },
    });
    await transaction.pedagogicalProgress.updateMany({
      where: { enrollmentId: enrollment.id },
      data: {
        startDate: new Date("2084-02-01"),
        endDate: new Date("2084-03-10"),
        endReason: "DROPPED",
      },
    });
    await transaction.enrollment.update({
      where: { id: enrollment.id },
      data: {
        entryDate: new Date("2084-02-01"),
        exitDate: new Date("2084-03-10"),
        exitReason: "DROPPED",
      },
    });
  });
  const ended = await caller(ADMIN, NOW).dashboard.pending({ kind: "students", page: 1 });
  assert.equal(ended.total, future.total + 1);
  assert.equal(
    ended.items.some((item) => item.id === studentId),
    true,
  );
  await cleanHomeEnrollments();
});
void it("does not confuse confirmed attendance with the completed class record or flag unfinished lessons", async () => {
  const catalog = await seedDashboardCatalog();
  const classId = await seedClass({ code: "Home Records", teacherId: TEACHER.id, ...catalog });
  const ended = await seedSession({ classId, date: "2084-03-09", attendanceConfirmedAt: NOW });
  const running = await seedSession({ classId, date: "2084-03-10" });
  const cancelled = await seedSession({ classId, date: "2084-03-08", status: "CANCELLED" });
  const removed = await seedSession({ classId, date: "2084-03-07" });
  await db.classSession.update({ where: { id: removed }, data: { deletedAt: NOW } });
  const pending = await caller(ADMIN, NOW).dashboard.pending({ kind: "lessons", page: 1 });
  const own = pending.items.filter((item) => item.title.startsWith(TEST_PREFIX));
  assert.deepEqual(
    own.map((item) => item.id),
    [ended],
  );
  assert.deepEqual(own[0]?.action, { kind: "lesson", id: ended });
  const afterEnd = await caller(ADMIN, new Date("2084-03-10T19:00:00Z")).dashboard.pending({
    kind: "lessons",
    page: 1,
  });
  assert.equal(
    afterEnd.items.some((item) => item.id === running),
    true,
  );
  assert.equal(
    afterEnd.items.some((item) => item.id === cancelled || item.id === removed),
    false,
  );
});

void it("composes the school overview and keeps unallocated cash distinct from agreements", async () => {
  const baseline = await caller(ADMIN, NOW).dashboard.business();
  const studentId = await seedStudent({ suffix: "Home business", createdAt: NOW });
  const payer = await db.payer.create({ data: { name: `${TEST_PREFIX}Home payer` } });
  try {
    const original = await db.contract.create({
      data: { studentId, payerId: payer.id, agreedOn: new Date("2084-03-01") },
    });
    await db.contract.create({
      data: {
        studentId,
        payerId: payer.id,
        agreedOn: new Date("2084-03-02"),
        renewedFromId: original.id,
      },
    });
    await db.paymentEntry.createMany({
      data: [
        { payerId: payer.id, date: new Date("2084-03-10"), amountCents: 12500, method: "PIX" },
        { payerId: payer.id, date: new Date("2084-03-11"), amountCents: 99900, method: "PIX" },
        {
          payerId: payer.id,
          date: new Date("2084-03-10"),
          amountCents: 88800,
          method: "PIX",
          deletedAt: NOW,
        },
      ],
    });
    const business = await caller(ADMIN, NOW).dashboard.business();
    assert.equal(business.receivedCents, baseline.receivedCents + 12500);
    assert.equal(business.newContracts, baseline.newContracts + 1);
    assert.equal(business.renewals, baseline.renewals + 1);
    const home = await caller(ADMIN, NOW).dashboard.home();
    assert.equal(home.today, "2084-03-10");
    assert.equal(home.canViewFinance, true);
    assert.equal(home.groups.length, 9);
    assert.equal(
      home.groups
        .find((group) => group.kind === "contracts")
        ?.items.some((item) => item.id === studentId),
      false,
    );
    assert.equal(home.agenda.total, 0);
  } finally {
    await db.paymentEntry.deleteMany({ where: { payerId: payer.id } });
    await db.contract.deleteMany({ where: { payerId: payer.id, renewedFromId: { not: null } } });
    await db.contract.deleteMany({ where: { payerId: payer.id } });
    await db.payer.delete({ where: { id: payer.id } });
  }
});

void it("orders unpublished placements by effective entry before pagination, including the semester-date fallback", async () => {
  const catalog = await seedDashboardCatalog();
  const stage = await db.stage.findUniqueOrThrow({ where: { id: catalog.stageId } });
  const placements: string[] = [];
  try {
    // Older draft rows with later entry dates must not hide the earlier effective entries.
    for (let index = 0; index < 13; index++) {
      const studentId = await seedStudent({ suffix: `Home late entry ${index}`, createdAt: NOW });
      const row = await db.semesterPlacement.create({
        data: {
          semesterId: catalog.semesterId,
          studentId,
          trackId: stage.trackId,
          stageId: stage.id,
          mode: "ENTRY",
          effectiveDate: new Date("2084-04-01"),
          recordedById: ADMIN.id,
        },
      });
      placements.push(row.id);
    }
    const tomorrowStudent = await seedStudent({ suffix: "Home tomorrow entry", createdAt: NOW });
    const tomorrow = await db.semesterPlacement.create({
      data: {
        semesterId: catalog.semesterId,
        studentId: tomorrowStudent,
        trackId: stage.trackId,
        mode: "ENTRY",
        effectiveDate: new Date("2084-03-11"),
        recordedById: ADMIN.id,
      },
    });
    placements.push(tomorrow.id);
    const pastStudent = await seedStudent({ suffix: "Home past entry", createdAt: NOW });
    const past = await db.semesterPlacement.create({
      data: {
        semesterId: catalog.semesterId,
        studentId: pastStudent,
        trackId: stage.trackId,
        mode: "ENTRY",
        recordedById: ADMIN.id,
      },
    });
    placements.push(past.id);
    const home = await caller(ADMIN, NOW).dashboard.home();
    const preview = home.groups.find((group) => group.kind === "semester");
    assert.equal(preview?.total, 15);
    assert.equal(preview?.items.length, 3);
    assert.deepEqual(
      preview?.items.slice(0, 2).map((item) => [item.id, item.timing]),
      [
        [past.id, { kind: "entry", date: "2084-02-01" }],
        [tomorrow.id, { kind: "entry", date: "2084-03-11" }],
      ],
    );
    const last = await caller(ADMIN, NOW).dashboard.pending({ kind: "semester", page: 2 });
    assert.equal(last.total, 15);
    assert.deepEqual(
      last.items.map((item) => item.date),
      ["2084-04-01", "2084-04-01", "2084-04-01"],
    );
  } finally {
    await db.semesterPlacement.deleteMany({ where: { id: { in: placements } } });
  }
});

void it("dates correction and allocation waits from received work rather than the visit or lead creation date", async () => {
  const candidateIds: string[] = [];
  const visits: string[] = [];
  try {
    for (const [suffix, visitDate, uploadedAt, waitingAt] of [
      ["Earlier visit, newer upload", "2084-03-01", "2084-03-10T12:00:00Z", "2084-03-09T12:00:00Z"],
      ["Later visit, oldest upload", "2084-03-05", "2084-03-07T02:30:00Z", "2084-03-08T02:30:00Z"],
    ]) {
      const candidate = await db.admissionCandidate.create({
        data: {
          fullName: `${TEST_PREFIX}${suffix}`,
          email: "home-wait@example.com",
          recordedById: ADMIN.id,
          allocationPendingAt: new Date(waitingAt!),
          allocationPendingReason: "Aguardando horário compatível",
        },
      });
      candidateIds.push(candidate.id);
      const visit = await db.entryVisit.create({
        data: {
          candidateId: candidate.id,
          kind: "PLACEMENT",
          date: new Date(visitDate!),
          startTime: new Date("1970-01-01T10:00:00Z"),
          endTime: new Date("1970-01-01T11:00:00Z"),
          format: "IN_PERSON",
          recordedById: ADMIN.id,
          assessment: {
            create: {
              bucket: "test-private",
              key: `home/${candidate.id}`,
              fileName: "placement.pdf",
              contentType: "application/pdf",
              byteLength: 10,
              uploadedById: ADMIN.id,
              uploadedAt: new Date(uploadedAt!),
            },
          },
        },
      });
      visits.push(visit.id);
    }
    const placement = await caller(ADMIN, NOW).dashboard.pending({ kind: "placement", page: 1 });
    assert.deepEqual(
      placement.items.map((item) => item.id),
      [visits[1], visits[0]],
    );
    assert.equal(placement.items[0]?.date, "2084-03-06");
    assert.deepEqual(placement.items[0]?.timing, {
      kind: "waiting",
      since: "2084-03-07T02:30:00.000Z",
    });
    const allocation = await caller(ADMIN, NOW).dashboard.pending({ kind: "allocation", page: 1 });
    assert.deepEqual(
      allocation.items.map((item) => item.id),
      [candidateIds[1], candidateIds[0]],
    );
    assert.equal(allocation.items[0]?.date, "2084-03-07");
    assert.deepEqual(allocation.items[0]?.timing, {
      kind: "waiting",
      since: "2084-03-08T02:30:00.000Z",
    });
  } finally {
    await db.entryVisitAssessment.deleteMany({ where: { visitId: { in: visits } } });
    await db.entryVisit.deleteMany({ where: { id: { in: visits } } });
    await db.admissionCandidate.deleteMany({ where: { id: { in: candidateIds } } });
  }
});
