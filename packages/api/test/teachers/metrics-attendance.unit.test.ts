import assert from "node:assert/strict";
import { it } from "node:test";
import {
  metricAttendance,
  type AttendanceDatabase,
} from "../../src/teachers/metrics-attendance.js";

void it("counts only due eligible attendance, preserves absences and excludes another teacher's coverage", async () => {
  const time = (value: string): Date => new Date(`1970-01-01T${value}:00Z`);
  const base = {
    id: "session",
    scheduleSlotId: null,
    classId: "class",
    date: new Date("2026-11-11"),
    startTime: time("14:00"),
    endTime: time("15:00"),
    attendanceConfirmedAt: new Date("2026-11-11T19:00:00Z"),
    classRecord: { deletedAt: null, teachingTeacherId: "teacher" },
    substitutions: [],
    attendanceRows: [
      { enrollmentId: "enrollment", status: "PRESENT" as const, makeupCoverages: [] },
    ],
  };
  const database: AttendanceDatabase = {
    classSubstitution: { findMany: () => Promise.resolve([]) },
    classSession: {
      findMany: () =>
        Promise.resolve([
          base,
          {
            ...base,
            endTime: time("15:30"),
            attendanceRows: [
              {
                enrollmentId: "enrollment",
                status: "ABSENT" as const,
                makeupCoverages: [{ minutes: 120 }],
              },
            ],
          },
          { ...base, attendanceConfirmedAt: null },
          { ...base, attendanceRows: [] },
          { ...base, classRecord: { deletedAt: null, teachingTeacherId: "substitute" } },
          { ...base, date: new Date("2026-11-12"), endTime: time("18:00") },
          { ...base, date: new Date("2026-08-01") },
        ]),
    },
  };
  const result = await metricAttendance(database, {
    teacherId: "teacher",
    now: new Date("2026-11-12T15:00:00Z"),
    classes: [
      {
        id: "class",
        teacherId: "teacher",
        teacher: { id: "teacher", name: "Teacher", teacherProfile: null },
        teacherAssignments: [],
        semester: { startDate: new Date("2026-08-01"), endDate: new Date("2026-12-20") },
        enrollments: [
          {
            id: "other-enrollment",
            studentId: "other-student",
            entryDate: new Date("2026-09-01"),
            exitDate: null,
          },
          {
            id: "enrollment",
            studentId: "student",
            entryDate: new Date("2026-09-01"),
            exitDate: null,
          },
        ],
      },
    ],
  });
  assert.deepEqual(result.classes, [{ classId: "class", due: 5, confirmed: 4 }]);
  assert.equal(result.students.length, 2);
  assert.deepEqual(
    result.students.filter((row) => row.studentId === "student"),
    [
      {
        studentId: "student",
        classId: "class",
        heldMinutes: 150,
        absentMinutes: 90,
        compensatedMinutes: 90,
        missingRows: 1,
        due: 4,
        confirmed: 3,
      },
    ],
  );
});

void it("attributes recurring-slot attendance to the substitute only on its matching date and slot", async () => {
  const day = new Date("2026-11-11");
  const session = {
    id: "session",
    classId: "class",
    scheduleSlotId: "slot",
    date: day,
    startTime: new Date("1970-01-01T14:00:00Z"),
    endTime: new Date("1970-01-01T15:00:00Z"),
    attendanceConfirmedAt: day,
    classRecord: null,
    attendanceRows: [
      { enrollmentId: "enrollment", status: "ABSENT" as const, makeupCoverages: [] },
    ],
  };
  const database: AttendanceDatabase = {
    classSubstitution: {
      findMany: () =>
        Promise.resolve([
          {
            classId: "class",
            classSessionId: null,
            scheduleSlotId: "slot",
            date: day,
            teacherId: "substitute",
          },
        ]),
    },
    classSession: {
      findMany: () =>
        Promise.resolve([
          session,
          { ...session, id: "other-day", date: new Date("2026-11-10") },
          { ...session, id: "other-slot", scheduleSlotId: "other-slot" },
        ]),
    },
  };
  const input = {
    now: new Date("2026-11-12T20:00:00Z"),
    classes: [
      {
        id: "class",
        teacherId: "usual",
        teacher: { id: "usual", name: "Teacher", teacherProfile: null },
        teacherAssignments: [],
        semester: { startDate: new Date("2026-08-01"), endDate: new Date("2026-12-20") },
        enrollments: [
          {
            id: "enrollment",
            studentId: "student",
            entryDate: new Date("2026-09-01"),
            exitDate: null,
          },
        ],
      },
    ],
  };
  const usual = await metricAttendance(database, { ...input, teacherId: "usual" });
  const substitute = await metricAttendance(database, { ...input, teacherId: "substitute" });
  assert.deepEqual(usual.classes, [{ classId: "class", due: 2, confirmed: 2 }]);
  assert.deepEqual(substitute.classes, [{ classId: "class", due: 1, confirmed: 1 }]);
  assert.equal(usual.students[0]?.heldMinutes, 120);
  assert.equal(substitute.students[0]?.heldMinutes, 60);
  assert.equal(substitute.students[0]?.absentMinutes, 60);
});
