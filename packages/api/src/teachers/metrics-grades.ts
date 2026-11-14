import { teacherResponsibilityPeriods } from "./responsibility.js";
import { inWindow } from "./metric-rules.js";
import type { MetricGroup } from "./metrics-types.js";
export type GradeEvidence = {
  id: string;
  studentId: string;
  classId: string;
  bookId: string;
  score: number;
  phase: string;
  competence: string;
};

export type MetricBook = { id: string; name: string; students: Set<string> };
type GradeCollection = {
  gradeCandidates: Map<string, GradeEvidence[]>;
  books: Map<string, MetricBook>;
};
type Enrollment = MetricGroup["enrollments"][number];
type Progress = Enrollment["progressRecords"][number];
type Periods = ReturnType<typeof teacherResponsibilityPeriods>;
type ProgressContext = {
  group: MetricGroup;
  enrollment: Enrollment;
  progress: Progress;
  periods: Periods;
};
export function collectMetricGrades(
  classes: MetricGroup[],
  input: { teacherId: string; today: Date },
): GradeCollection {
  const gradeCandidates = new Map<string, GradeEvidence[]>();
  const books = new Map<string, { id: string; name: string; students: Set<string> }>();
  for (const group of classes) {
    const periods = teacherResponsibilityPeriods(group, input.teacherId);
    for (const enrollment of group.enrollments)
      collectEnrollmentGrades(
        { group, enrollment, periods, today: input.today },
        { gradeCandidates, books },
      );
  }
  return { gradeCandidates, books };
}

function collectEnrollmentGrades(
  input: { group: MetricGroup; enrollment: Enrollment; periods: Periods; today: Date },
  collection: GradeCollection,
): void {
  const { group, enrollment, periods, today } = input;
  const { gradeCandidates, books } = collection;
  for (const progress of enrollment.progressRecords) {
    const start = Math.max(
      group.semester.startDate.getTime(),
      enrollment.entryDate.getTime(),
      progress.startDate.getTime(),
    );
    const end = Math.min(
      today.getTime(),
      group.semester.endDate.getTime(),
      progress.endDate?.getTime() ?? Infinity,
    );
    if (
      start > end ||
      !periods.some(
        (period) => period.start.getTime() <= end && (!period.end || period.end.getTime() > start),
      )
    )
      continue;
    const book = books.get(progress.stage.id) ?? {
      ...progress.stage,
      students: new Set<string>(),
    };
    book.students.add(enrollment.studentId);
    books.set(book.id, book);
    if (!progress.assessment || progress.assessment.deletedAt) continue;
    collectProgressGrades(
      { group, enrollment, progress, periods, bookId: book.id },
      gradeCandidates,
    );
  }
}
function collectProgressGrades(
  input: ProgressContext & { bookId: string },
  gradeCandidates: Map<string, GradeEvidence[]>,
): void {
  const { group, enrollment, progress, periods, bookId } = input;
  for (const grade of progress.assessment?.grades ?? []) {
    if (!eligibleGrade(grade, { group, enrollment, progress, periods })) continue;
    const candidates = gradeCandidates.get(grade.id) ?? [];
    if (!candidates.some((row) => row.classId === group.id))
      candidates.push({
        id: grade.id,
        studentId: enrollment.studentId,
        classId: group.id,
        bookId,
        score: Number(grade.score),
        phase: grade.phase,
        competence: grade.competence,
      });
    gradeCandidates.set(grade.id, candidates);
  }
}
function eligibleGrade(
  grade: NonNullable<Progress["assessment"]>["grades"][number],
  input: ProgressContext,
): boolean {
  const { group, enrollment, progress, periods } = input;
  return !(
    grade.assessedOn < group.semester.startDate ||
    grade.assessedOn < enrollment.entryDate ||
    (enrollment.exitDate && grade.assessedOn >= enrollment.exitDate) ||
    grade.assessedOn < progress.startDate ||
    (progress.endDate && grade.assessedOn > progress.endDate) ||
    !periods.some((period) => inWindow(grade.assessedOn, period))
  );
}
