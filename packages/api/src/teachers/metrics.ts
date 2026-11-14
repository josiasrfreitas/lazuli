import type { Prisma } from "@lazuli/db";
import { readStudentHealthBatch } from "@lazuli/db/student-health-batch";
import { saoPauloDateOnly } from "@lazuli/domain";
import { usualTeacherOn } from "./responsibility.js";
import { mean, studentMean, absenceSummary } from "./metric-rules.js";
import { metricAttendance } from "./metrics-attendance.js";
import { readTeacher } from "./read.js";
import { readMetricGroups, readMetricOccurrences } from "./metrics-read.js";
import { collectMetricGrades } from "./metrics-grades.js";
import {
  summarizeMetricStudent,
  summarizeMetricBook,
  summarizeMetricClass,
  summarizeMetricOccurrence,
} from "./metrics-summary.js";
import type { TeacherMetricsSummary } from "./metrics-types.js";
const ISO_DATE_LENGTH = 10;
/** Current-cohort monitoring; the health aggregate is not a causal teacher rating. */
export async function teacherMetrics(
  database: Prisma.TransactionClient,
  input: { teacherId: string; now: Date },
): Promise<TeacherMetricsSummary> {
  await readTeacher(database, input.teacherId);
  const today = new Date(saoPauloDateOnly(input.now));
  const groups = await readMetricGroups(database, { teacherId: input.teacherId, today });
  const classes = groups.filter((group) => usualTeacherOn(group, today)?.id === input.teacherId);
  const students = new Map(
    classes.flatMap((group) =>
      group.enrollments.map((row) => [row.studentId, row.student.fullName] as const),
    ),
  );
  const health = await readStudentHealthBatch({
    database,
    ids: [...students.keys()],
    now: input.now,
  });
  const byStudent = new Map(health.map((row) => [row.studentId, row]));
  const from =
    classes.length > 0
      ? new Date(Math.min(...classes.map((row) => row.semester.startDate.getTime())))
      : today;
  const attendanceEvidence = await metricAttendance(database, {
    classes,
    teacherId: input.teacherId,
    now: input.now,
  });
  const attendance = attendanceEvidence.students;
  const calls = { due: 0, confirmed: 0 };
  for (const row of attendanceEvidence.classes) {
    calls.due += row.due;
    calls.confirmed += row.confirmed;
  }
  const occurrences = await readMetricOccurrences(database, { students, classes, from, today });
  const { gradeCandidates, books } = collectMetricGrades(classes, {
    today,
    teacherId: input.teacherId,
  });
  // An assessment linked to overlapping classes is not evidence of either teacher's work.
  const grades = [...gradeCandidates.values()].flatMap((rows) => (rows.length === 1 ? rows : []));
  const studentRows = [...students].map(([id, name]) =>
    summarizeMetricStudent({ id, name }, { byStudent, attendance, grades, occurrences }),
  );
  return {
    from: from.toISOString().slice(0, ISO_DATE_LENGTH),
    through: saoPauloDateOnly(input.now),
    semesters: [...new Set(classes.map((row) => row.semester.name))],
    score: mean(studentRows.map((row) => row.score)),
    coveredStudents: studentRows.filter((row) => row.score !== null).length,
    studentCount: studentRows.length,
    assessedStudents: new Set(grades.map((row) => row.studentId)).size,
    gradeCount: grades.length,
    ambiguousGrades: [...gradeCandidates.values()].filter((rows) => rows.length > 1).length,
    grades: studentMean(grades),
    attendance: absenceSummary(attendance),
    calls,
    students: studentRows,
    books: [...books.values()].map((book) => summarizeMetricBook(book, grades)),
    classes: classes.map((group) =>
      summarizeMetricClass(group, { today, studentRows, grades, attendance, attendanceEvidence }),
    ),
    occurrences: occurrences.map((row) => summarizeMetricOccurrence(row, students)),
  };
}
