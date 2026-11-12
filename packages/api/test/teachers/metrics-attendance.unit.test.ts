import assert from "node:assert/strict";
import { it } from "node:test";
import type { Prisma } from "@lazuli/db";
import { metricAttendance } from "../../src/teachers/metrics-attendance.js";

void it("counts only due eligible attendance, preserves absences and excludes another teacher's coverage", async () => {
  const time = (value: string): Date => new Date(`1970-01-01T${value}:00Z`);
  const base = {
    classId: "class",
    date: new Date("2026-11-11"),
    startTime: time("14:00"),
    endTime: time("15:00"),
    attendanceConfirmedAt: new Date("2026-11-11T19:00:00Z"),
    classRecord: { deletedAt: null, teachingTeacherId: "teacher" },
    substitutions: [],
    attendanceRows: [{ enrollmentId: "enrollment", status: "PRESENT", makeupCoverages: [] }],
  };
  const database = {
    classSession: {
      findMany: async () => [
        base,
        {
          ...base,
          endTime: time("15:30"),
          attendanceRows: [
            { enrollmentId: "enrollment", status: "ABSENT", makeupCoverages: [{ minutes: 120 }] },
          ],
        },
        { ...base, attendanceConfirmedAt: null },
        { ...base, attendanceRows: [] },
        { ...base, classRecord: { deletedAt: null, teachingTeacherId: "substitute" } },
        { ...base, date: new Date("2026-11-12"), endTime: time("18:00") },
        { ...base, date: new Date("2026-08-01") },
      ],
    },
  } as unknown as Prisma.TransactionClient;
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
