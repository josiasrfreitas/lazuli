import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { db } from "@lazuli/db";
import { createCaller } from "@lazuli/api";
import { createEnrollmentSuite, ENROLLMENT_ADMIN_ID } from "../support/enrollment/fixtures.js";

const suite = createEnrollmentSuite({
  prefix: "Student profile #171 ",
  catalogKey: "profile171_line",
  catalogKeyPrefix: "profile171_",
  teacherId: "00000000-0000-4000-8000-000000000171",
  teacherEmail: "profile171@example.com",
  teacherName: "Profile teacher",
  semesterName: "Student profile #171 2080.1",
  semesterStart: "2080-01-01",
  semesterEnd: "2080-06-30",
});
const now = new Date("2080-03-01T03:00:00Z");
function caller(): ReturnType<typeof createCaller> {
  return createCaller({
    db,
    now,
    staffUser: {
      id: ENROLLMENT_ADMIN_ID,
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN",
      isEnabled: true,
    },
  });
}
void describe("student pedagogical profile", () => {
  suite.registerDbLifecycle();
  void it("uses civil entry and exclusive exit dates and excludes other students and deleted enrollments", async () => {
    await suite.ensureTeacherUser();
    const catalog = await suite.seedTwoStageCatalog();
    const classroom = await suite.createRegularClass({
      code: "A",
      sharedStageId: catalog.firstStageId,
      semesterId: catalog.semesterId,
    });
    const student = await suite.createStudent("Target");
    const other = await suite.createStudent("Other");
    const entries = await Promise.all([
      db.enrollment.create({
        data: {
          studentId: student.id,
          classId: classroom.id,
          entryDate: new Date("2080-01-01"),
          exitDate: new Date("2080-03-01"),
          exitReason: "TRANSFERRED",
        },
      }),
      db.enrollment.create({
        data: {
          studentId: student.id,
          classId: classroom.id,
          entryDate: new Date("2080-03-01"),
          exitDate: new Date("2080-04-01"),
          exitReason: "TRANSFERRED",
          progressRecords: {
            create: {
              stageId: catalog.firstStageId,
              startDate: new Date("2080-03-01"),
              endDate: new Date("2080-04-01"),
              endReason: "TRANSFERRED",
            },
          },
        },
      }),
      db.enrollment.create({
        data: { studentId: student.id, classId: classroom.id, entryDate: new Date("2080-04-01") },
      }),
      db.enrollment.create({
        data: { studentId: other.id, classId: classroom.id, entryDate: new Date("2080-01-01") },
      }),
      db.enrollment.create({
        data: {
          studentId: student.id,
          classId: classroom.id,
          entryDate: new Date("2079-01-01"),
          exitDate: new Date("2079-02-01"),
          exitReason: "CORRECTION",
          deletedAt: now,
        },
      }),
    ]);
    const profile = await caller().students.pedagogy({ id: student.id });
    assert.equal(profile.today, "2080-03-01");
    assert.deepEqual(
      profile.enrollments.map((row) => row.id),
      [entries[2]!.id, entries[1]!.id, entries[0]!.id],
    );
    assert.deepEqual(
      profile.enrollments.map((row) => row.current),
      [false, true, false],
    );
    assert.equal(profile.enrollments[1]?.progress[0]?.stage, "Student profile #171 Stage 1");
    assert.equal(profile.enrollments[1]?.class.teacher?.name, "Profile teacher");
    assert.deepEqual(profile.enrollments[1]?.attendance, {
      heldSessions: 0,
      presentCount: 0,
      percent: null,
      flagged: false,
    });
  });
});
