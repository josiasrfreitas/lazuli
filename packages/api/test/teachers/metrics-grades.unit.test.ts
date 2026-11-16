import assert from "node:assert/strict";
import { it } from "node:test";
import { Prisma } from "@lazuli/db/prisma";
import { collectMetricGrades } from "../../src/teachers/metrics-grades.js";
import type { MetricGroup } from "../../src/teachers/metrics-types.js";

type Progress = MetricGroup["enrollments"][number]["progressRecords"][number];
function progress(): Progress {
  return {
    stage: { id: "book", name: "Book" },
    startDate: new Date("2026-08-01"),
    endDate: new Date("2026-10-01"),
    assessment: {
      id: "assessment",
      deletedAt: null,
      grades: ["2026-08-31", "2026-09-01", "2026-10-01"].map((date) => ({
        id: date,
        assessedOn: new Date(date),
        score: new Prisma.Decimal(80),
        phase: "BLOCK_ONE",
        competence: "ORAL",
      })),
    },
  };
}
function group(): MetricGroup {
  const teacher = { id: "teacher", name: "Teacher", teacherProfile: null };
  return {
    id: "class",
    teacherId: teacher.id,
    teacher,
    teacherAssignments: [],
    scheduleType: "REGULAR",
    portalClassName: "Class",
    sharedStage: null,
    scheduleSlots: [],
    semester: {
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-20"),
      name: "Semester",
    },
    enrollments: [
      {
        id: "enrollment",
        classId: "class",
        studentId: "student",
        student: { fullName: "Student" },
        entryDate: new Date("2026-09-01"),
        exitDate: new Date("2026-10-01"),
        progressRecords: [progress()],
      },
    ],
  };
}
void it("includes the entry date but excludes grades before entry and on exit", () => {
  const result = collectMetricGrades([group()], {
    teacherId: "teacher",
    today: new Date("2026-11-01"),
  });
  assert.deepEqual([...result.gradeCandidates.keys()], ["2026-09-01"]);
  assert.deepEqual(result.gradeCandidates.get("2026-09-01"), [
    {
      id: "2026-09-01",
      studentId: "student",
      classId: "class",
      bookId: "book",
      score: 80,
      phase: "BLOCK_ONE",
      competence: "ORAL",
    },
  ]);
  assert.deepEqual([...result.books.get("book")!.students], ["student"]);
});
void it("deduplicates repeated progress in one class but retains cross-class ambiguity", () => {
  const first = group();
  first.enrollments[0]!.progressRecords.push(progress());
  const second = { ...group(), id: "other-class" };
  const result = collectMetricGrades([first, second], {
    teacherId: "teacher",
    today: new Date("2026-11-01"),
  });
  assert.deepEqual(
    result.gradeCandidates.get("2026-09-01")?.map((row) => row.classId),
    ["class", "other-class"],
  );
  assert.equal(result.gradeCandidates.size, 1);
  assert.equal(result.books.get("book")?.students.size, 1);
});
