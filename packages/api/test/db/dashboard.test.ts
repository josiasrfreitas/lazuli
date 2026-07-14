import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ADMIN,
  OTHER_TEACHER,
  TEACHER,
  TEST_PREFIX,
  caller,
  cleanDashboardDatabase,
  ensureDashboardUsers,
  seedClass,
  seedDashboardCatalog,
  seedSession,
  seedStudent,
} from "./dashboard-test-support.js";

const TODAY_DATE = "2084-03-10";
const CONFIRMED_PAST_DATE = "2084-03-09";
const CANCELLED_PAST_DATE = "2084-03-08";
const FUTURE_DATE = "2084-03-12";
const JULY_NOW = new Date("2026-07-14T15:00:00.000Z");
const TEACHER_HOME_NOW = new Date(`${TODAY_DATE}T15:00:00.000Z`);
const AFTER_PAST_SESSION_NOW = new Date("2084-03-11T20:00:00.000Z");
const ACTIVE_STUDENTS_ADDED = 3;
const NEW_THIS_MONTH_ADDED = 2;
const WARNING_CLASS_CODE = "Warnings";
const WARNING_CLASS_INTERNAL_CODE = `${TEST_PREFIX}${WARNING_CLASS_CODE}`;

void describe("dashboard API", { concurrency: false }, () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDashboardDatabase();
    await db.$disconnect();
  });

  databaseIt(
    "counts active students and new-this-month using America/Sao_Paulo boundaries",
    countActiveStudents,
  );
  databaseIt("derives untaken-session operational warnings", deriveUntakenWarnings);
  databaseIt("returns teacher home sessions only for owned classes", returnOwnedTeacherHome);
  databaseIt("enforces dashboard role procedures", enforceDashboardRoles);
});

async function countActiveStudents(): Promise<void> {
  await cleanDashboardDatabase();
  await ensureDashboardUsers();
  const monthStart = new Date("2026-07-01T03:00:00.000Z");
  const nextMonthStart = new Date("2026-08-01T03:00:00.000Z");
  const existing = {
    total: await db.student.count({ where: { status: "ACTIVE" } }),
    newThisMonth: await db.student.count({
      where: {
        status: "ACTIVE",
        createdAt: { gte: monthStart, lt: nextMonthStart },
      },
    }),
  };

  await seedStudent({ suffix: "Old Active", createdAt: new Date("2026-06-30T23:00:00.000Z") });
  await seedStudent({
    suffix: "Month Start Active",
    createdAt: monthStart,
  });
  await seedStudent({
    suffix: "Month End Active",
    createdAt: new Date("2026-08-01T02:59:00.000Z"),
  });
  await seedStudent({
    suffix: "Inactive Current Month",
    status: "INACTIVE",
    createdAt: new Date("2026-07-10T12:00:00.000Z"),
  });

  const result = await caller(ADMIN, JULY_NOW).dashboard.adminMetrics();

  assert.deepEqual(result.activeStudents, {
    total: existing.total + ACTIVE_STUDENTS_ADDED,
    newThisMonth: existing.newThisMonth + NEW_THIS_MONTH_ADDED,
  });
}

async function deriveUntakenWarnings(): Promise<void> {
  await cleanDashboardDatabase();
  await ensureDashboardUsers();
  const existing = await caller(ADMIN, AFTER_PAST_SESSION_NOW).dashboard.adminMetrics();
  const { stageId, semesterId } = await seedDashboardCatalog();
  const classId = await seedClass({
    code: WARNING_CLASS_CODE,
    teacherId: TEACHER.id,
    semesterId,
    stageId,
  });
  const untakenSessionId = await seedSession({ classId, date: TODAY_DATE });
  await seedSession({
    classId,
    date: CONFIRMED_PAST_DATE,
    attendanceConfirmedAt: new Date(`${TODAY_DATE}T20:00:00.000Z`),
  });
  await seedSession({ classId, date: FUTURE_DATE });
  await seedSession({ classId, date: CANCELLED_PAST_DATE, status: "CANCELLED" });

  const result = await caller(ADMIN, AFTER_PAST_SESSION_NOW).dashboard.adminMetrics();

  assert.equal(
    result.operationalWarnings.totalUntakenSessions,
    existing.operationalWarnings.totalUntakenSessions + 1,
  );
  const seededWarning = result.operationalWarnings.untakenSessions.find(
    (session) => session.sessionId === untakenSessionId,
  );
  assert.equal(seededWarning?.classInternalCode, WARNING_CLASS_INTERNAL_CODE);
}

async function returnOwnedTeacherHome(): Promise<void> {
  await cleanDashboardDatabase();
  await ensureDashboardUsers();
  const { stageId, semesterId } = await seedDashboardCatalog();
  const ownedClassId = await seedClass({
    code: "Owned A",
    teacherId: TEACHER.id,
    semesterId,
    stageId,
  });
  const secondOwnedClassId = await seedClass({
    code: "Owned B",
    teacherId: TEACHER.id,
    semesterId,
    stageId,
  });
  const otherClassId = await seedClass({
    code: "Other",
    teacherId: OTHER_TEACHER.id,
    semesterId,
    stageId,
  });
  const todaySessionId = await seedSession({ classId: ownedClassId, date: TODAY_DATE });
  await seedSession({ classId: ownedClassId, date: "2084-03-17" });
  const secondClassNextSessionId = await seedSession({
    classId: secondOwnedClassId,
    date: "2084-03-12",
  });
  await seedSession({ classId: otherClassId, date: TODAY_DATE });

  const result = await caller(TEACHER, TEACHER_HOME_NOW).dashboard.teacherHome();

  assert.equal(result.today, TODAY_DATE);
  assert.deepEqual(
    result.todaySessions.map((session) => session.sessionId),
    [todaySessionId],
  );
  assert.deepEqual(
    result.nextSessionsByClass.map((classHome) => ({
      classId: classHome.classId,
      nextSessionId: classHome.nextSession?.sessionId,
    })),
    [
      { classId: ownedClassId, nextSessionId: todaySessionId },
      { classId: secondOwnedClassId, nextSessionId: secondClassNextSessionId },
    ],
  );
}

async function enforceDashboardRoles(): Promise<void> {
  await cleanDashboardDatabase();
  await ensureDashboardUsers();

  await assert.rejects(caller(TEACHER, JULY_NOW).dashboard.adminMetrics(), /FORBIDDEN/);
  await assert.rejects(caller(ADMIN, JULY_NOW).dashboard.teacherHome(), /FORBIDDEN/);
}
