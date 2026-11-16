import type { readStudentHealthBatch } from "@lazuli/db/student-health-batch";
import { mean, studentMean, absenceSummary } from "./metric-rules.js";
import type { AttendanceEvidence } from "./metrics-attendance.js";
import type { GradeEvidence, MetricBook } from "./metrics-grades.js";
import type { MetricGroup, MetricOccurrence, TeacherMetricsSummary } from "./metrics-types.js";
const ACCOUNT_SUMMARY_LIMIT = 600;
const RESPONSE_SUMMARY_LIMIT = 300;
const ISO_DATE_LENGTH = 10;
type HealthRow = Awaited<ReturnType<typeof readStudentHealthBatch>>[number];
type StudentRow = TeacherMetricsSummary["students"][number];
export function summarizeMetricStudent(
  input: { id: string; name: string },
  evidence: {
    byStudent: Map<string, HealthRow>;
    attendance: AttendanceEvidence["students"];
    grades: GradeEvidence[];
    occurrences: MetricOccurrence[];
  },
): StudentRow {
  const { id, name } = input;
  const { byStudent, attendance, grades, occurrences } = evidence;
  const result = byStudent.get(id);
  const ownAttendance = attendance.filter((row) => row.studentId === id);
  return {
    id,
    name,
    ...healthSummary(result),
    grades: studentMean(grades.filter((row) => row.studentId === id)),
    gradeCount: grades.filter((row) => row.studentId === id).length,
    attendance: absenceSummary(ownAttendance),
    occurrences: occurrences.filter((row) => row.studentId === id).length,
    pending: occurrences.filter((row) => row.studentId === id && row.status !== "CLOSED").length,
  };
}
function healthSummary(
  result: HealthRow | undefined,
): Pick<
  StudentRow,
  "score" | "level" | "healthGradeCount" | "healthHeldSessions" | "availableIndicators"
> {
  if (!result)
    return {
      score: null,
      level: "INSUFFICIENT_DATA",
      healthGradeCount: 0,
      healthHeldSessions: 0,
      availableIndicators: 0,
    };
  return {
    score: result.score ?? null,
    level: result.level ?? "INSUFFICIENT_DATA",
    healthGradeCount: result.gradeCount ?? 0,
    healthHeldSessions: result.heldSessions ?? 0,
    availableIndicators: result.availableIndicators ?? 0,
  };
}
export function summarizeMetricBook(
  book: MetricBook,
  grades: GradeEvidence[],
): TeacherMetricsSummary["books"][number] {
  const rows = grades.filter((row) => row.bookId === book.id);
  return {
    id: book.id,
    name: book.name,
    average: studentMean(rows),
    gradeCount: rows.length,
    studentCount: book.students.size,
    assessedStudents: new Set(rows.map((row) => row.studentId)).size,
    phases: ["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"].map((phase) => ({
      phase,
      average: studentMean(rows.filter((row) => row.phase === phase)),
    })),
  };
}
export function summarizeMetricClass(
  group: MetricGroup,
  input: {
    today: Date;
    studentRows: StudentRow[];
    grades: GradeEvidence[];
    attendance: AttendanceEvidence["students"];
    attendanceEvidence: AttendanceEvidence;
  },
): TeacherMetricsSummary["classes"][number] {
  const { today, studentRows, grades, attendance, attendanceEvidence } = input;
  const ids = new Set(group.enrollments.map((row) => row.studentId));
  const rows = studentRows.filter((row) => ids.has(row.id));
  return {
    id: group.id,
    name: group.portalClassName,
    scheduleType: group.scheduleType,
    stages: classStages(group, today),
    schedule: group.scheduleSlots,
    studentCount: rows.length,
    studentIds: [...ids],
    score: mean(rows.map((row) => row.score)),
    grades: studentMean(grades.filter((row) => row.classId === group.id)),
    attendance: absenceSummary(attendance.filter((row) => row.classId === group.id)),
    calls: attendanceEvidence.classes.find((row) => row.classId === group.id) ?? {
      due: 0,
      confirmed: 0,
    },
  };
}
function classStages(group: MetricGroup, today: Date): string[] {
  return group.sharedStage
    ? [group.sharedStage.name]
    : [
        ...new Set(
          group.enrollments.flatMap((enrollment) =>
            enrollment.progressRecords
              .filter((progress) => progress.endDate === null || progress.endDate > today)
              .map((progress) => progress.stage.name),
          ),
        ),
      ].toSorted();
}
export function summarizeMetricOccurrence(
  row: MetricOccurrence,
  students: Map<string, string>,
): TeacherMetricsSummary["occurrences"][number] {
  return {
    id: row.id,
    studentId: row.studentId,
    name: students.get(row.studentId) ?? "Aluno",
    title: row.title,
    summary:
      row.account.length > ACCOUNT_SUMMARY_LIMIT
        ? `${row.account.slice(0, ACCOUNT_SUMMARY_LIMIT)}…`
        : row.account,
    initialResponse:
      row.initialResponse && row.initialResponse.length > RESPONSE_SUMMARY_LIMIT
        ? `${row.initialResponse.slice(0, RESPONSE_SUMMARY_LIMIT)}…`
        : row.initialResponse,
    category: row.category,
    recordedBy: row.recordedBy.name,
    outsideClass: row.classSession === null,
    status: row.status,
    date:
      (row.classSession?.date ?? row.occurredOn)?.toISOString().slice(0, ISO_DATE_LENGTH) ?? null,
    accompanied: row.interventions.some((link) => link.intervention.studentId === row.studentId),
  };
}
