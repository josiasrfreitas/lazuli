import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import {
  canRead,
  dateOnly,
  timeOnly,
  recordSessionInclude,
  type RecordContext,
} from "../class-records/data.js";
import { listClassRecords } from "../class-records/read.js";
import { notFound } from "../trpc/errors.js";
import { canReadAppointment } from "../appointments/data.js";

type ClassModel = Prisma.ClassGetPayload<Prisma.ClassDefaultArgs>;
type AttendanceModel = Prisma.AttendanceGetPayload<Prisma.AttendanceDefaultArgs>;
type ScheduleSlot = Prisma.ClassScheduleSlotGetPayload<Prisma.ClassScheduleSlotDefaultArgs>;
type WorkspaceClass = {
  id: string;
  name: string;
  format: ClassModel["format"];
  scheduleType: ClassModel["scheduleType"];
  stage: string;
  semester: { name: string; startDate: Date; endDate: Date };
  current: boolean;
  schedule: Array<{ weekday: ScheduleSlot["weekday"]; startTime: string; endTime: string }>;
};
type WorkspaceStudent = {
  id: string;
  name: string;
  current: boolean;
  classes: Array<{
    id: string;
    name: string;
    scheduleType: ClassModel["scheduleType"];
    enrollmentId: string;
    progress: Array<{ id: string; stage: string }>;
  }>;
};
type WorkspaceStudentDetail = WorkspaceStudent & {
  attendance: Array<{
    id: string;
    sessionId: string;
    status: AttendanceModel["status"];
    date: string;
    className: string;
  }>;
};

const workspaceClassSelect = {
  id: true,
  portalClassName: true,
  format: true,
  scheduleType: true,
  status: true,
  semester: { select: { name: true, startDate: true, endDate: true } },
  sharedStage: { select: { name: true } },
  ...responsibilitySelect,
  substitutions: { select: { id: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    select: { weekday: true, startTime: true, endTime: true },
  },
} satisfies Prisma.ClassSelect;
type WorkspaceClassRow = Prisma.ClassGetPayload<{ select: typeof workspaceClassSelect }>;
const workspaceAppointmentSelect = {
  studentId: true,
  status: true,
  purpose: true,
  recordedAt: true,
  teacher: { select: { id: true, name: true } },
  targetClassSession: { include: recordSessionInclude },
} satisfies Prisma.PedagogicalAppointmentSelect;
type WorkspaceAppointment = Prisma.PedagogicalAppointmentGetPayload<{
  select: typeof workspaceAppointmentSelect;
}>;
const workspaceStudentSelect = {
  id: true,
  fullName: true,
  enrollments: {
    select: {
      id: true,
      classId: true,
      class: { select: { portalClassName: true, scheduleType: true } },
      progressRecords: {
        select: { id: true, stage: { select: { name: true } } },
      },
    },
  },
  pedagogicalInterventions: { select: { id: true }, take: 1 },
} satisfies Prisma.StudentSelect;
type WorkspaceStudentRow = Prisma.StudentGetPayload<{ select: typeof workspaceStudentSelect }>;

export async function workspaceClasses(context: RecordContext): Promise<WorkspaceClass[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const rows = await loadWorkspaceClassRows(context, today);
  return rows.map((row) => ({
    id: row.id,
    name: row.portalClassName,
    format: row.format,
    scheduleType: row.scheduleType,
    stage: row.sharedStage?.name ?? "Percursos individuais",
    semester: row.semester,
    current:
      row.status === "ACTIVE" &&
      row.semester.endDate >= today &&
      (usualTeacherOn(row, today)?.id === context.staffUser.id || row.substitutions.length > 0),
    schedule: row.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: timeOnly(slot.startTime),
      endTime: timeOnly(slot.endTime),
    })),
  }));
}

async function loadWorkspaceClassRows(
  context: RecordContext,
  today: Date,
): Promise<WorkspaceClassRow[]> {
  return context.database.class.findMany({
    where: {
      deletedAt: null,
      OR: [
        { teacherId: context.staffUser.id },
        { teacherAssignments: { some: { teacherId: context.staffUser.id, supersededAt: null } } },
        {
          substitutions: {
            some: { teacherId: context.staffUser.id, revokedAt: null, deletedAt: null },
          },
        },
        { sessions: { some: { classRecord: { teachingTeacherId: context.staffUser.id } } } },
      ],
    },
    select: {
      ...workspaceClassSelect,
      substitutions: {
        where: {
          teacherId: context.staffUser.id,
          revokedAt: null,
          deletedAt: null,
          date: { gte: today },
        },
        select: workspaceClassSelect.substitutions.select,
      },
    },
    orderBy: [{ semester: { startDate: "desc" } }, { portalClassName: "asc" }],
  });
}

export function currentEnrollment(today: Date): Prisma.EnrollmentWhereInput {
  return {
    deletedAt: null,
    entryDate: { lte: today },
    OR: [{ exitDate: null }, { exitDate: { gt: today } }],
    actions: {
      none: { status: "SCHEDULED", kind: { in: ["PAUSE", "EXIT"] }, effectiveDate: { lte: today } },
    },
  };
}

export async function workspaceStudents(context: RecordContext): Promise<WorkspaceStudent[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const assignedClasses = await workspaceClasses(context);
  const classes = assignedClasses.filter((row) => row.current);
  const appointments = await loadWorkspaceAppointments(context);
  const activeAppointments = new Set(
    appointments
      .filter(
        (row) =>
          row.status === "SCHEDULED" ||
          (row.purpose === "ASSESSMENT" && row.status !== "CANCELLED"),
      )
      .map((row) => row.studentId),
  );
  const rows = await loadWorkspaceStudentRows(context, { today, classes, appointments });
  return rows.map((row) => ({
    id: row.id,
    name: row.fullName,
    current:
      row.enrollments.length > 0 ||
      activeAppointments.has(row.id) ||
      row.pedagogicalInterventions.length > 0,
    classes: row.enrollments.map((item) => ({
      id: item.classId,
      name: item.class.portalClassName,
      scheduleType: item.class.scheduleType,
      enrollmentId: item.id,
      progress: item.progressRecords.map((progress) => ({
        id: progress.id,
        stage: progress.stage.name,
      })),
    })),
  }));
}

async function loadWorkspaceAppointments(context: RecordContext): Promise<WorkspaceAppointment[]> {
  const candidates = await context.database.pedagogicalAppointment.findMany({
    where: {
      deletedAt: null,
      OR: [
        { teacherId: context.staffUser.id },
        {
          targetClassSession: {
            class: {
              OR: [
                { teacherId: context.staffUser.id },
                {
                  teacherAssignments: {
                    some: { teacherId: context.staffUser.id, supersededAt: null },
                  },
                },
                {
                  substitutions: {
                    some: { teacherId: context.staffUser.id, revokedAt: null, deletedAt: null },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    select: workspaceAppointmentSelect,
  });
  return candidates.filter((row) => canReadAppointment(context, row));
}

async function loadWorkspaceStudentRows(
  context: RecordContext,
  {
    today,
    classes,
    appointments,
  }: { today: Date; classes: WorkspaceClass[]; appointments: WorkspaceAppointment[] },
): Promise<WorkspaceStudentRow[]> {
  const enrollment = { ...currentEnrollment(today), classId: { in: classes.map((row) => row.id) } };
  return context.database.student.findMany({
    where: workspaceStudentWhere(context, { enrollment, appointments }),
    select: {
      ...workspaceStudentSelect,
      enrollments: {
        ...workspaceStudentSelect.enrollments,
        where: enrollment,
        select: {
          ...workspaceStudentSelect.enrollments.select,
          progressRecords: {
            ...workspaceStudentSelect.enrollments.select.progressRecords,
            where: {
              deletedAt: null,
              startDate: { lte: today },
              OR: [{ endDate: null }, { endDate: { gte: today } }],
            },
          },
        },
      },
      pedagogicalInterventions: {
        ...workspaceStudentSelect.pedagogicalInterventions,
        where: { responsibleId: context.staffUser.id, deletedAt: null },
      },
    },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });
}

function workspaceStudentWhere(
  context: RecordContext,
  {
    enrollment,
    appointments,
  }: { enrollment: Prisma.EnrollmentWhereInput; appointments: WorkspaceAppointment[] },
): Prisma.StudentWhereInput {
  return {
    deletedAt: null,
    OR: [
      { enrollments: { some: enrollment } },
      { id: { in: appointments.map((row) => row.studentId) } },
      {
        pedagogicalInterventions: {
          some: { responsibleId: context.staffUser.id, deletedAt: null },
        },
      },
      { pedagogicalOccurrences: { some: { recordedById: context.staffUser.id, deletedAt: null } } },
      {
        enrollments: {
          some: {
            attendanceRows: {
              some: {
                deletedAt: null,
                classSession: { classRecord: { teachingTeacherId: context.staffUser.id } },
              },
            },
          },
        },
      },
    ],
  };
}

export async function workspaceClass(
  context: RecordContext,
  id: string,
): Promise<
  WorkspaceClass & {
    students: WorkspaceStudent[];
    lessons: Awaited<ReturnType<typeof listClassRecords>>;
  }
> {
  const assignedClasses = await workspaceClasses(context);
  const group = assignedClasses.find((row) => row.id === id);
  if (!group) throw notFound("Turma não encontrada entre suas atribuições.");
  const [students, lessons] = await Promise.all([
    workspaceStudents(context),
    listClassRecords(context, {
      classId: id,
      from: dateOnly(group.semester.startDate),
      to: dateOnly(group.semester.endDate),
    }),
  ]);
  return {
    ...group,
    students: group.current
      ? students.filter((row) => row.classes.some((item) => item.id === id))
      : [],
    lessons,
  };
}

export async function workspaceStudent(
  context: RecordContext,
  id: string,
): Promise<WorkspaceStudentDetail> {
  const accessibleStudents = await workspaceStudents(context);
  const student = accessibleStudents.find((row) => row.id === id);
  if (!student) throw notFound("Aluno não encontrado entre suas atribuições.");
  const attendance = await context.database.attendance.findMany({
    where: {
      deletedAt: null,
      enrollment: { studentId: id },
      classSession: { classRecord: { teachingTeacherId: context.staffUser.id } },
    },
    select: {
      id: true,
      status: true,
      classSession: {
        select: { id: true, date: true, class: { select: { portalClassName: true } } },
      },
    },
    orderBy: { classSession: { date: "desc" } },
    take: 100,
  });
  return {
    ...student,
    attendance: attendance.map((row) => ({
      id: row.id,
      sessionId: row.classSession.id,
      status: row.status,
      date: dateOnly(row.classSession.date),
      className: row.classSession.class.portalClassName,
    })),
  };
}

export async function pendingLessons(context: RecordContext): Promise<
  {
    id: string;
    classId: string;
    className: string;
    date: string;
    startTime: string;
    endTime: string;
  }[]
> {
  const sessions = await context.database.classSession.findMany({
    where: {
      deletedAt: null,
      status: "SCHEDULED",
      classRecord: null,
      date: { lte: new Date(saoPauloDateOnly(context.now)) },
      class: {
        deletedAt: null,
        OR: [
          { teacherId: context.staffUser.id },
          { teacherAssignments: { some: { teacherId: context.staffUser.id } } },
          { substitutions: { some: { teacherId: context.staffUser.id, revokedAt: null } } },
        ],
      },
    },
    include: recordSessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return sessions
    .filter((row) => canRead(context, row) && sessionEndInstant(row) <= context.now)
    .map((row) => ({
      id: row.id,
      classId: row.classId,
      className: row.class.portalClassName,
      date: dateOnly(row.date),
      startTime: timeOnly(row.startTime),
      endTime: timeOnly(row.endTime),
    }));
}
