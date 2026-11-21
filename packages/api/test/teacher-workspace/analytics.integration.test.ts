import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import { confirmSession } from "../../src/attendance/confirm.js";
import {
  ADMIN,
  TEACHER,
  OTHER_TEACHER,
  caller,
  cleanDashboardDatabase,
  ensureDashboardUsers,
  seedDashboardCatalog,
  seedClass,
  seedSession,
  seedStudent,
  TEST_PREFIX,
} from "../support/dashboard-test-support.js";

void it("counts confirmed attendance only for the teacher who taught the lesson", async () => {
  const now = new Date("2084-04-30T17:00:00Z");
  await ensureDashboardUsers();
  try {
    const catalog = await seedDashboardCatalog();
    const group = await seedClass({ code: "Analytics", teacherId: TEACHER.id, ...catalog });
    const student = await seedStudent({ suffix: "Analytics", createdAt: now });
    const enrollment = await db.enrollment.create({
      data: {
        studentId: student,
        classId: group,
        entryDate: new Date("2084-02-01"),
        progressRecords: {
          create: { stageId: catalog.stageId, startDate: new Date("2084-02-01") },
        },
      },
    });
    for (const [date, teacher, status, confirmed] of [
      ["2084-04-26", TEACHER, "PRESENT", true],
      ["2084-04-25", OTHER_TEACHER, "ABSENT", true],
      ["2084-04-24", TEACHER, "ABSENT", false],
      ["2084-02-01", TEACHER, "ABSENT", true],
    ] as const) {
      const session = await seedSession({
        classId: group,
        date,
        attendanceConfirmedAt: confirmed ? now : null,
      });
      await db.classSession.update({
        where: { id: session },
        data: { usualTeacherId: TEACHER.id },
      });
      await db.classSessionRecord.create({
        data: { classSessionId: session, teachingTeacherId: teacher.id, snapshot: {} },
      });
      await db.attendance.create({
        data: { classSessionId: session, enrollmentId: enrollment.id, status },
      });
    }
    const standalone = await seedSession({ classId: group, date: "2084-04-27" });
    await db.$transaction((database) =>
      confirmSession({
        database,
        staffUser: ADMIN,
        values: { sessionId: standalone, rows: [] },
        now,
      }),
    );
    const unmarked = await seedStudent({ suffix: "Analytics sem chamada", createdAt: now });
    await db.enrollment.create({
      data: {
        studentId: unmarked,
        classId: group,
        entryDate: now,
        progressRecords: {
          create: { stageId: catalog.stageId, startDate: now },
        },
      },
    });
    const teacher = caller(TEACHER, now).teacherWorkspace;
    const actual = await teacher.analytics({ days: 30 });
    assert.deepEqual(
      actual.map((row) => [row.studentId, row.present, row.absent]),
      [
        [student, 2, 0],
        [unmarked, 0, 0],
      ],
    );
    const substitute = await caller(OTHER_TEACHER, now).teacherWorkspace.analytics({ days: 30 });
    assert.deepEqual(
      substitute.map((row) => [row.studentId, row.present, row.absent]),
      [[student, 0, 1]],
    );
    const longer = await teacher.analytics({ days: 180 });
    assert.equal(longer[0]?.absent, 1);
    const weeks = await teacher.weeklyAttendance({ days: 30 });
    assert.deepEqual(
      weeks.map((row) => [row.classId, row.marked, row.present]),
      [[group, 2, 2]],
    );
    await assert.rejects(caller(TEACHER, now).dashboard.classTickets({ year: 2084 }), {
      code: "FORBIDDEN",
    });
    const tickets = await caller(ADMIN, now).dashboard.classTickets({ year: 2084 });
    assert.equal(tickets.rows.find((row) => row.id === group)?.missing, 2);
  } finally {
    const classes = { class: { internalCode: { startsWith: TEST_PREFIX } } };
    await db.attendance.deleteMany({ where: { classSession: classes } });
    await db.classSessionRecord.deleteMany({ where: { classSession: classes } });
    await db.$transaction(async (tx) => {
      await tx.pedagogicalProgress.deleteMany({ where: { enrollment: classes } });
      await tx.enrollment.deleteMany({ where: classes });
    });
    await cleanDashboardDatabase();
    await db.$disconnect();
  }
});
