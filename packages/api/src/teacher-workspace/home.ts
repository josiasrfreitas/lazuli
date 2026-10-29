import { ACADEMIC_COMPETENCES, saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import type { AppointmentSnapshot } from "@lazuli/validators";
import {
  assessmentClasses,
  readClassAssessments,
  readStudentAssessments,
} from "../assessments/read.js";
import { appointmentInclude, canReadAppointment } from "../appointments/data.js";
import { dateOnly, timeOnly, type RecordContext } from "../class-records/data.js";
import {
  homePlanning,
  HOME_WINDOW_DAYS,
  shiftHomeDate,
  type HomePlanning,
} from "./home-planning.js";
import { workspaceClasses } from "./read.js";
import { assignedVisits } from "./visits.js";

const REGULAR_ASSESSMENT_PHASES = 2;
type HomeAssessment = {
  progressId: string;
  studentName: string;
  className: string;
  stageName: string;
  missingGrades: number;
};
type HomeAppointment = {
  id: string;
  studentName: string;
  purpose: AppointmentSnapshot["purpose"];
  date: string;
  startTime: string;
  endTime: string;
  overdue: boolean;
  ageDays: number;
};
type TeacherHomeOverview = HomePlanning & {
  today: string;
  teacherName: string;
  windowDays: number;
  assessments: HomeAssessment[];
  assessmentAppointments: HomeAppointment[];
  appointments: HomeAppointment[];
  pendingAppointments: HomeAppointment[];
  visits: Array<{
    id: string;
    studentName: string;
    kind: "PLACEMENT" | "INTRODUCTION" | "TRIAL";
    date: string;
    startTime: string;
    correctionPending: boolean;
  }>;
};

export async function teacherHomeOverview(context: RecordContext): Promise<TeacherHomeOverview> {
  const today = saoPauloDateOnly(context.now);
  const [classes, appointments, assessmentGroups, visits] = await Promise.all([
    workspaceClasses(context),
    homeAppointments(context, today),
    assessmentClasses(context),
    assignedVisits(context),
  ]);
  const currentClassIds = new Set(classes.filter((row) => row.current).map((row) => row.id));
  const [planning, assessments] = await Promise.all([
    homePlanning(context, { currentClassIds, today }),
    homeAssessments(
      context,
      assessmentGroups.filter((row) => currentClassIds.has(row.id)),
    ),
  ]);
  return {
    today,
    teacherName: context.staffUser.name,
    windowDays: HOME_WINDOW_DAYS,
    assessments,
    assessmentAppointments: appointments.filter(
      (row) => row.purpose === "ASSESSMENT" && row.ageDays < 3,
    ),
    appointments: appointments.filter((row) => row.purpose !== "ASSESSMENT" && row.ageDays < 3),
    pendingAppointments: appointments.filter((row) => row.ageDays >= 3),
    visits: visits
      .filter(
        (row) =>
          row.date <= shiftHomeDate(today, HOME_WINDOW_DAYS) &&
          ((row.status === "SCHEDULED" && (row.date >= today || row.canRecord)) ||
            (row.status !== "ABSENT" &&
              row.canRecord &&
              row.assessment &&
              !row.assessment.stageId)),
      )
      .map((row) => ({
        id: row.id,
        studentName: row.candidate.fullName,
        kind: row.kind,
        date: row.date,
        startTime: row.startTime,
        correctionPending: Boolean(row.assessment && !row.assessment.stageId),
      }))
      .toSorted(
        (comparedLeft, comparedRight) =>
          comparedLeft.date.localeCompare(comparedRight.date) ||
          comparedLeft.startTime.localeCompare(comparedRight.startTime),
      ),
    ...planning,
  };
}

async function homeAppointments(context: RecordContext, today: string): Promise<HomeAppointment[]> {
  const rows = await context.database.pedagogicalAppointment.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      date: { lte: new Date(shiftHomeDate(today, HOME_WINDOW_DAYS)) },
      student: { deletedAt: null },
    },
    include: {
      student: appointmentInclude.student,
      teacher: appointmentInclude.teacher,
      targetClassSession: appointmentInclude.targetClassSession,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  return rows
    .filter(
      (row) =>
        canReadAppointment(context, row) &&
        (!row.targetClassSession ||
          (!row.targetClassSession.deletedAt && row.targetClassSession.status !== "CANCELLED")),
    )
    .map((row) => ({
      id: row.id,
      studentName: row.student.fullName,
      purpose: row.purpose,
      date: dateOnly(row.date),
      startTime: timeOnly(row.startTime),
      endTime: timeOnly(row.endTime),
      overdue: sessionEndInstant(row) <= context.now,
      ageDays: Math.floor((context.now.getTime() - sessionEndInstant(row).getTime()) / 86_400_000),
    }));
}

async function homeAssessments(
  context: RecordContext,
  groups: Array<{ id: string }>,
): Promise<HomeAssessment[]> {
  const assigned = await context.database.pedagogicalAppointment.findMany({
    where: {
      teacherId: context.staffUser.id,
      purpose: "ASSESSMENT",
      deletedAt: null,
      status: { not: "CANCELLED" },
      student: { deletedAt: null },
    },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  const results = await Promise.all([
    ...groups.map((group) => readClassAssessments(context, group.id)),
    ...assigned.map((row) => readStudentAssessments(context, row.studentId)),
  ]);
  const seen = new Set<string>();
  return results
    .flat()
    .flatMap((row) => {
      const key = row.assessmentId ?? row.progressId;
      if (seen.has(key) || !row.current || row.decision) return [];
      seen.add(key);
      const recorded = row.grades.filter((grade) => grade.phase !== "RECOVERY").length;
      const total = ACADEMIC_COMPETENCES.length * REGULAR_ASSESSMENT_PHASES;
      if (recorded >= total) return [];
      return [
        {
          progressId: row.progressId,
          studentName: row.student.fullName,
          className: row.class.name,
          stageName: row.stage.name,
          missingGrades: total - recorded,
        },
      ];
    })
    .toSorted(
      (left, right) =>
        left.className.localeCompare(right.className, "pt-BR") ||
        left.studentName.localeCompare(right.studentName, "pt-BR"),
    );
}
