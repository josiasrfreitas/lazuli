import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { eligibleInterventionStaff, invalid, type FollowUpContext } from "./data.js";

const ISO_DATE_LENGTH = 10;
const ISO_TIME_START_INDEX = 11;
const ISO_SECOND_END_INDEX = 19;

const sessionInclude = {
  usualTeacher: { select: { id: true, name: true } },
  class: {
    select: {
      id: true,
      portalClassName: true,
      scheduleType: true,
      format: true,
      sharedStage: { select: { name: true } },
      ...responsibilitySelect,
      substitutions: {
        where: { revokedAt: null, deletedAt: null },
        select: {
          teacherId: true,
          teacher: { select: { id: true, name: true } },
          date: true,
          scheduleSlotId: true,
          classSessionId: true,
        },
        orderBy: { recordedAt: "desc" },
      },
    },
  },
} satisfies Prisma.ClassSessionInclude;
type Session = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;
type SessionRange = { from: string; to: string };
type SessionOptions = { studentId?: string | undefined; range?: SessionRange | undefined };
type EnrollmentWindow = { classId: string; entryDate: Date; exitDate: Date | null };
type OccurrenceSessionView = {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  className: string;
  classId: string;
  teacherName: string | null;
  substitute: boolean;
  stageName: string | null;
  scheduleType: Session["class"]["scheduleType"];
  format: Session["class"]["format"];
};
function reportTeacher(session: Session): {
  teacher: { id: string; name: string } | null;
  substitute: boolean;
} {
  const usual = session.responsibilityFrozenAt
    ? session.usualTeacher
    : usualTeacherOn(session.class, session.date);
  const substitute = session.class.substitutions.find(
    (row) =>
      row.date.getTime() === session.date.getTime() &&
      (session.scheduleSlotId
        ? row.scheduleSlotId === session.scheduleSlotId
        : row.classSessionId === session.id),
  );
  return { teacher: substitute?.teacher ?? usual, substitute: Boolean(substitute) };
}
function canReport(context: FollowUpContext, session: Session): boolean {
  return (
    context.staffUser.role !== "TEACHER" ||
    reportTeacher(session).teacher?.id === context.staffUser.id
  );
}
const schoolTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function hasStarted(session: { date: Date; startTime: Date }, now: Date): boolean {
  const today = saoPauloDateOnly(now);
  const date = session.date.toISOString().slice(0, ISO_DATE_LENGTH);
  const time = schoolTime.format(now);
  return (
    date < today ||
    (date === today &&
      session.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_SECOND_END_INDEX) <= time)
  );
}

export async function occurrenceSessions(
  context: FollowUpContext,
  options: SessionOptions,
): Promise<OccurrenceSessionView[]> {
  const { studentId, range } = options;
  const today = new Date(saoPauloDateOnly(context.now));
  const through = range && new Date(range.to) < today ? new Date(range.to) : today;
  if (range && new Date(range.from) > through) return [];
  const enrollments = await enrollmentWindows(context, { studentId, range, through });
  if (enrollments?.length === 0) return [];
  const rows = await context.database.classSession.findMany({
    where: sessionWhere({ enrollments, range, through }),
    include: sessionInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    ...(range ? {} : { take: 600 }),
  });
  return rows
    .filter((row) => hasStarted(row, context.now) && canReport(context, row))
    .map((row) => projectSession(row));
}

async function enrollmentWindows(
  context: FollowUpContext,
  options: { studentId: string | undefined; range: SessionRange | undefined; through: Date },
): Promise<EnrollmentWindow[] | null> {
  const { studentId, range, through } = options;
  if (!studentId) return null;
  return context.database.enrollment.findMany({
    where: {
      studentId,
      deletedAt: null,
      entryDate: { lte: through },
      ...(range ? { OR: [{ exitDate: null }, { exitDate: { gt: new Date(range.from) } }] } : {}),
    },
    select: { classId: true, entryDate: true, exitDate: true },
  });
}

function sessionWhere(input: {
  enrollments: EnrollmentWindow[] | null;
  range: SessionRange | undefined;
  through: Date;
}): Prisma.ClassSessionWhereInput {
  const { enrollments, range, through } = input;
  return {
    deletedAt: null,
    status: "SCHEDULED",
    date: { lte: through, ...(range ? { gte: new Date(range.from) } : {}) },
    class: { deletedAt: null },
    ...(enrollments
      ? {
          OR: enrollments.map((row) => ({
            classId: row.classId,
            date: { gte: row.entryDate, ...(row.exitDate ? { lt: row.exitDate } : {}) },
          })),
        }
      : {}),
  };
}

function projectSession(row: Session): OccurrenceSessionView {
  const { teacher, substitute } = reportTeacher(row);
  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    className: row.class.portalClassName,
    classId: row.classId,
    teacherName: teacher?.name ?? null,
    substitute,
    stageName: row.class.sharedStage?.name ?? null,
    scheduleType: row.class.scheduleType,
    format: row.class.format,
  };
}
export async function loadReportSession(context: FollowUpContext, id: string): Promise<Session> {
  const row = await context.database.classSession.findFirst({
    where: { id, deletedAt: null, status: "SCHEDULED", class: { deletedAt: null } },
    include: sessionInclude,
  });
  if (!row || !canReport(context, row)) invalid("Aula indisponível para este professor.");
  if (!hasStarted(row, context.now)) invalid("Escolha uma aula em andamento ou que já aconteceu.");
  return row;
}
export async function occurrenceRoster(
  context: FollowUpContext,
  sessionId: string,
): Promise<{ id: string; fullName: string }[]> {
  const session = await loadReportSession(context, sessionId);
  return context.database.student.findMany({
    where: {
      deletedAt: null,
      enrollments: {
        some: {
          deletedAt: null,
          classId: session.classId,
          entryDate: { lte: session.date },
          OR: [{ exitDate: null }, { exitDate: { gt: session.date } }],
        },
      },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
export async function interventionStaff(
  context: FollowUpContext,
): Promise<{ id: string; name: string }[]> {
  return context.database.user.findMany({
    where: eligibleInterventionStaff(context),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function interventionFormOptions(
  context: FollowUpContext,
  studentId: string,
): Promise<{
  staff: { id: string; name: string }[];
  suggestedResponsible: { classNames: string[]; id: string; name: string } | null;
}> {
  const today = new Date(saoPauloDateOnly(context.now));
  const [staff, enrollments] = await Promise.all([
    interventionStaff(context),
    context.database.enrollment.findMany({
      where: {
        studentId,
        student: { deletedAt: null },
        deletedAt: null,
        class: { deletedAt: null },
        entryDate: { lte: today },
        OR: [{ exitDate: null }, { exitDate: { gt: today } }],
        actions: {
          none: {
            status: "SCHEDULED",
            kind: { in: ["PAUSE", "EXIT"] },
            effectiveDate: { lte: today },
          },
        },
      },
      select: { class: { select: { portalClassName: true, ...responsibilitySelect } } },
    }),
  ]);
  const teachers = enrollments.map((row) => usualTeacherOn(row.class, today));
  const teacherIds = new Set(teachers.map((teacher) => teacher?.id ?? null));
  const onlyTeacher = teachers[0];
  const suggestedResponsible =
    teacherIds.size === 1 && onlyTeacher && staff.some((person) => person.id === onlyTeacher.id)
      ? {
          ...onlyTeacher,
          classNames: [...new Set(enrollments.map((row) => row.class.portalClassName))],
        }
      : null;
  return { staff, suggestedResponsible };
}
