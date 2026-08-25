import { resolveSemesterForDate, SemesterBucketError, type SemesterWindow } from "@lazuli/domain";
import type {
  StudentListInput,
  StudentListOutput,
  StudentListRow,
  StudentListStatusFilter,
} from "@lazuli/validators";

import { computeEnrollmentPercentInWindow } from "../attendance/percent.js";
import { receivables, type StudentOverdueTotal } from "../receivables/index.js";
import { isMinorInSaoPaulo } from "./date-rules.js";
import {
  buildStudentListWhere,
  countHeaderFacts,
  countStudentsByTab,
  findStudentPage,
  STUDENT_PAGE_SIZE,
  toScheduleLabel,
  type OpenEnrollmentRow,
  type StudentListDatabase,
  type StudentPageRow,
} from "./list-query.js";

/**
 * The paginated students listing behind `/alunos`: one row already answers
 * "which class, is the student attending, are they up to date". Attendance is
 * scoped to the semester containing `now`; when no semester covers that date the
 * column degrades to "sem dados" instead of failing the whole page.
 */

type ListStudentsValues = StudentListInput & { now: Date; staffUserId: string };

type ListStudentsInput = {
  database: StudentListDatabase;
  values: ListStudentsValues;
};

type AttendanceFacts = StudentListRow["attendance"];

const NO_ATTENDANCE_DATA: AttendanceFacts = { percent: null, flagged: false };

export async function listStudents(input: ListStudentsInput): Promise<StudentListOutput> {
  const where = buildStudentListWhere(input.values);
  const semester = await resolveCurrentSemester(input.database, input.values.now);
  const [students, counts, header] = await Promise.all([
    findStudentPage({ database: input.database, values: { where, page: input.values.page } }),
    countStudentsByTab({ database: input.database, search: input.values.search }),
    countHeaderFacts({ database: input.database, semesterId: semester?.id ?? null }),
  ]);

  return {
    rows: await buildRows({ database: input.database, values: input.values, students, semester }),
    page: input.values.page,
    pageCount: pageCountFor(totalForStatus({ counts, status: input.values.status })),
    counts,
    ...header,
  };
}

type BuildRowsInput = {
  database: StudentListDatabase;
  values: { now: Date; staffUserId: string };
  students: StudentPageRow[];
  semester: SemesterWindow | null;
};

/** Also drives `students.preview`, which renders a single row by student id. */
export async function buildRows(input: BuildRowsInput): Promise<StudentListRow[]> {
  const [attendanceByStudent, financeByStudent] = await Promise.all([
    readAttendanceByStudent(input),
    readFinanceByStudent(input),
  ]);

  return input.students.map((student) => ({
    id: student.id,
    fullName: student.fullName,
    isMinor: isMinorInSaoPaulo(student.birthDate),
    status: student.status,
    phone: student.phone,
    enrollment: toEnrollmentFacts(student.enrollments[0]),
    attendance: attendanceByStudent.get(student.id) ?? NO_ATTENDANCE_DATA,
    finance: toFinanceFacts(financeByStudent.get(student.id)),
  }));
}

/** One windowed percent per row; a page holds at most `STUDENT_PAGE_SIZE` students. */
async function readAttendanceByStudent(
  input: BuildRowsInput,
): Promise<Map<string, AttendanceFacts>> {
  const entries = await Promise.all(
    input.students.map(async (student) => {
      const facts = await readAttendance({
        database: input.database,
        values: { enrollment: student.enrollments[0], semester: input.semester },
      });

      return [student.id, facts] as const;
    }),
  );

  return new Map(entries);
}

async function readFinanceByStudent(
  input: BuildRowsInput,
): Promise<Map<string, StudentOverdueTotal>> {
  const totals = await receivables(input.database, input.values.staffUserId).studentOverdueTotals({
    studentIds: input.students.map((student) => student.id),
    now: input.values.now,
  });

  return new Map(totals.map((total) => [total.studentId, total]));
}

async function readAttendance(input: {
  database: StudentListDatabase;
  values: { enrollment: OpenEnrollmentRow | undefined; semester: SemesterWindow | null };
}): Promise<AttendanceFacts> {
  const { enrollment, semester } = input.values;

  if (enrollment === undefined || semester === null) {
    return NO_ATTENDANCE_DATA;
  }

  const { percent, flagged } = await computeEnrollmentPercentInWindow({
    database: input.database,
    values: { enrollment, semester },
  });

  return { percent, flagged };
}

function toEnrollmentFacts(
  enrollment: OpenEnrollmentRow | undefined,
): StudentListRow["enrollment"] {
  if (enrollment === undefined) {
    return null;
  }

  return {
    enrollmentId: enrollment.id,
    classId: enrollment.classId,
    classCode: enrollment.class.internalCode,
    scheduleLabel: toScheduleLabel(enrollment.class.scheduleSlots),
    teacherName: enrollment.class.teacher.name,
  };
}

function toFinanceFacts(total: StudentOverdueTotal | undefined): StudentListRow["finance"] {
  if (total === undefined || !total.hasActiveOrder) {
    return { kind: "none" };
  }

  if (total.overdueCents <= 0) {
    return { kind: "upToDate" };
  }

  return { kind: "overdue", overdueCents: total.overdueCents };
}

/** A date outside every semester window is a setup gap, not a reason to fail the listing. */
export async function resolveCurrentSemester(
  database: StudentListDatabase,
  now: Date,
): Promise<SemesterWindow | null> {
  const semesters = await database.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  try {
    return resolveSemesterForDate(now, semesters);
  } catch (error) {
    if (error instanceof SemesterBucketError) {
      return null;
    }

    throw error;
  }
}

function totalForStatus(input: {
  counts: StudentListOutput["counts"];
  status: StudentListStatusFilter;
}): number {
  if (input.status === "active") {
    return input.counts.active;
  }

  if (input.status === "inactive") {
    return input.counts.inactive;
  }

  return input.counts.all;
}

function pageCountFor(total: number): number {
  return Math.max(Math.ceil(total / STUDENT_PAGE_SIZE), 1);
}
