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
