import type {
  AcademicCompetence,
  AssessmentPhase,
  ClassScheduleType,
  OccurrenceCategory,
  OccurrenceStatus,
  Weekday,
} from "@lazuli/db/prisma";
import type { Prisma } from "@lazuli/db";
import type { readStudentHealthBatch } from "@lazuli/db/student-health-batch";
import type { AbsenceSummary } from "./metric-rules.js";
type StudentHealthLevel = Awaited<ReturnType<typeof readStudentHealthBatch>>[number]["level"];
export type MetricGroup = {
  id: string;
  teacherId: string;
  scheduleType: ClassScheduleType;
  portalClassName: string;
  teacher: { teacherProfile: { departureDate: Date | null } | null; id: string; name: string };
  sharedStage: { name: string } | null;
  semester: { startDate: Date; name: string; endDate: Date };
  scheduleSlots: { weekday: Weekday; startTime: Date; endTime: Date }[];
  teacherAssignments: {
    id: string;
    teacherId: string;
    teacher: { teacherProfile: { departureDate: Date | null } | null; id: string; name: string };
    effectiveDate: Date;
  }[];
  enrollments: {
    student: { fullName: string };
    id: string;
    classId: string;
    progressRecords: {
      stage: { id: string; name: string };
      startDate: Date;
      endDate: Date | null;
      assessment: {
        id: string;
        deletedAt: Date | null;
        grades: {
          id: string;
          score: Prisma.Decimal;
          phase: AssessmentPhase;
          competence: AcademicCompetence;
          assessedOn: Date;
        }[];
      } | null;
    }[];
    studentId: string;
    entryDate: Date;
    exitDate: Date | null;
  }[];
};
export type MetricOccurrence = {
  account: string;
  classSession: { date: Date } | null;
  id: string;
  status: OccurrenceStatus;
  recordedBy: { name: string };
  studentId: string;
  occurredOn: Date | null;
  category: OccurrenceCategory;
  title: string;
  initialResponse: string | null;
  interventions: { intervention: { studentId: string } }[];
};
export type TeacherMetricsSummary = {
  from: string;
  through: string;
  semesters: string[];
  score: number | null;
  coveredStudents: number;
  studentCount: number;
  assessedStudents: number;
  gradeCount: number;
  ambiguousGrades: number;
  grades: number | null;
  attendance: AbsenceSummary;
  calls: { due: number; confirmed: number };
  students: {
    id: string;
    name: string;
    score: number | null;
    level: StudentHealthLevel;
    healthGradeCount: number;
    healthHeldSessions: number;
    availableIndicators: number;
    grades: number | null;
    gradeCount: number;
    attendance: AbsenceSummary;
    occurrences: number;
    pending: number;
  }[];
  books: {
    id: string;
    name: string;
    average: number | null;
    gradeCount: number;
    studentCount: number;
    assessedStudents: number;
    phases: { phase: string; average: number | null }[];
  }[];
  classes: {
    id: string;
    name: string;
    scheduleType: ClassScheduleType;
    stages: string[];
    schedule: { weekday: Weekday; startTime: Date; endTime: Date }[];
    studentCount: number;
    studentIds: string[];
    score: number | null;
    grades: number | null;
    attendance: AbsenceSummary;
    calls: { classId: string; due: number; confirmed: number } | { due: number; confirmed: number };
  }[];
  occurrences: {
    id: string;
    studentId: string;
    name: string;
    title: string;
    summary: string;
    initialResponse: string | null;
    category: OccurrenceCategory;
    recordedBy: string;
    outsideClass: boolean;
    status: OccurrenceStatus;
    date: string | null;
    accompanied: boolean;
  }[];
};
