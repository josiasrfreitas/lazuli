import { responsibleTeacherId, weekDates } from "@lazuli/domain";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { meetingKey, meetingsBetween, type TeacherMeeting } from "../teachers/schedule.js";
import { requireAppointmentAdmin, type AppointmentContext } from "./data.js";

type AvailabilityInput = {
  teacherId: string;
  studentId: string;
  week: string;
  through?: string | undefined;
  excludeAppointmentId?: string | undefined;
};
type TimedRow = { id: string; date: Date; startTime: Date; endTime: Date };
type BusyInterval = { id: string; date: string; startTime: string; endTime: string; label: string };
type AvailabilityResult = {
  classes: {
    id: string;
    sessionId: string | null;
    classId: string;
    className: string;
    scheduleType: TeacherMeeting["scheduleType"];
    stageName: string | null;
    date: string;
    startTime: string;
    endTime: string;
    format: TeacherMeeting["format"];
    selectable: boolean;
  }[];
  teacherBusy: BusyInterval[];
  studentBusy: BusyInterval[];
  closedDays: { date: string; reason: string }[];
};
type AvailabilityData = {
  meetings: TeacherMeeting[];
  enrollments: { classId: string; entryDate: Date; exitDate: Date | null }[];
  appointments: (TimedRow & {
    teacherId: string | null;
    studentId: string;
    targetClassSessionId: string | null;
  })[];
  visits: (TimedRow & {
    teacherId: string | null;
    kind: string;
    candidate: { studentId: string | null };
  })[];
  closedDays: { date: Date; reason: string }[];
  sessions: { id: string }[];
};
type AvailabilityQuery = {
  database: AppointmentContext["database"];
  input: AvailabilityInput;
  range: { gte: Date; lte: Date };
};

/** Up to seven consecutive days; omitted through retains the legacy Monday–Sunday range. */
export async function appointmentAvailability(
  context: AppointmentContext,
  input: AvailabilityInput,
): Promise<AvailabilityResult> {
  requireAppointmentAdmin(context);
  const data = await loadAvailability(context, input);
  return projectAvailability(input, data);
}

async function loadAvailability(
  context: AppointmentContext,
  input: AvailabilityInput,
): Promise<AvailabilityData> {
  const { database } = context;
  const days = weekDates(input.week);
  const from = input.through ? input.week : days[0]!;
  const through = input.through ?? days[6]!;
  const query = { database, input, range: { gte: new Date(from), lte: new Date(through) } };
  const [meetings, enrollments, appointments, visits, closedDays, sessions] = await Promise.all([
    meetingsBetween({ database, from, through, now: context.now }),
    availabilityEnrollments(query),
    availabilityAppointments(query),
    availabilityVisits(query),
    availabilityClosedDays(query),
    availabilitySessions(query),
  ]);
  return { meetings, enrollments, appointments, visits, closedDays, sessions };
}

async function availabilityEnrollments({
  database,
  input,
  range,
}: AvailabilityQuery): Promise<AvailabilityData["enrollments"]> {
  return database.enrollment.findMany({
    where: {
      studentId: input.studentId,
      deletedAt: null,
      entryDate: { lte: range.lte },
      OR: [{ exitDate: null }, { exitDate: { gt: range.gte } }],
    },
    select: { classId: true, entryDate: true, exitDate: true },
  });
}

async function availabilityAppointments({
  database,
  input,
  range,
}: AvailabilityQuery): Promise<AvailabilityData["appointments"]> {
  return database.pedagogicalAppointment.findMany({
    where: {
      date: range,
      deletedAt: null,
      status: { not: "CANCELLED" },
      ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
      OR: [
        { teacherId: input.teacherId, targetClassSessionId: null },
        { studentId: input.studentId },
      ],
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      teacherId: true,
      studentId: true,
      targetClassSessionId: true,
    },
  });
}

async function availabilityVisits({
  database,
  input,
  range,
}: AvailabilityQuery): Promise<AvailabilityData["visits"]> {
  return database.entryVisit.findMany({
    where: {
      date: range,
      deletedAt: null,
      status: { not: "CANCELLED" },
      OR: [
        { teacherId: input.teacherId, kind: "INTRODUCTION" },
        { candidate: { studentId: input.studentId } },
      ],
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      teacherId: true,
      kind: true,
      candidate: { select: { studentId: true } },
    },
  });
}

async function availabilityClosedDays({
  database,
  range,
}: AvailabilityQuery): Promise<AvailabilityData["closedDays"]> {
  return database.schoolClosedDay.findMany({
    where: { date: range, deletedAt: null },
    select: { date: true, reason: true },
  });
}

async function availabilitySessions({
  database,
  range,
}: AvailabilityQuery): Promise<AvailabilityData["sessions"]> {
  return database.classSession.findMany({
    where: {
      date: range,
      status: "SCHEDULED",
      deletedAt: null,
      class: { status: "ACTIVE", deletedAt: null },
    },
    select: { id: true },
  });
}

function projectAvailability(input: AvailabilityInput, data: AvailabilityData): AvailabilityResult {
  const availableSessions = new Set(data.sessions.map((row) => row.id));
  const teacherMeetings = data.meetings.filter(
    (row) => !row.cancelled && responsibleTeacherId(row) === input.teacherId,
  );
  const studentMeetings = enrolledMeetings(data);
  return {
    classes: teacherMeetings.map((row) => classAvailability(row, availableSessions)),
    teacherBusy: teacherBusyIntervals(input, data),
    studentBusy: studentBusyIntervals(input, { data, studentMeetings }),
    closedDays: data.closedDays.map((row) => ({ date: dateOnly(row.date), reason: row.reason })),
  };
}

function classAvailability(
  row: TeacherMeeting,
  availableSessions: Set<string>,
): AvailabilityResult["classes"][number] {
  return {
    id: row.sessionId ?? meetingKey(row),
    sessionId: row.sessionId,
    classId: row.classId,
    className: row.className,
    scheduleType: row.scheduleType,
    stageName: row.stageName,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    format: row.format,
    selectable: Boolean(row.editable && row.sessionId && availableSessions.has(row.sessionId)),
  };
}

function enrolledMeetings(data: AvailabilityData): TeacherMeeting[] {
  return data.meetings.filter(
    (row) =>
      !row.cancelled &&
      data.enrollments.some(
        (enrollment) =>
          enrollment.classId === row.classId &&
          dateOnly(enrollment.entryDate) <= row.date &&
          (!enrollment.exitDate || dateOnly(enrollment.exitDate) > row.date),
      ),
  );
}

function interval(row: TimedRow): Omit<BusyInterval, "label"> {
  return {
    id: row.id,
    date: dateOnly(row.date),
    startTime: timeOnly(row.startTime),
    endTime: timeOnly(row.endTime),
  };
}

function teacherBusyIntervals(input: AvailabilityInput, data: AvailabilityData): BusyInterval[] {
  return [
    ...data.appointments
      .filter((row) => row.teacherId === input.teacherId && !row.targetClassSessionId)
      .map((row) => ({ ...interval(row), label: "Atendimento" })),
    ...data.visits
      .filter((row) => row.teacherId === input.teacherId && row.kind === "INTRODUCTION")
      .map((row) => ({ ...interval(row), label: "Experimental individual" })),
  ];
}

function studentBusyIntervals(
  input: AvailabilityInput,
  { data, studentMeetings }: { data: AvailabilityData; studentMeetings: TeacherMeeting[] },
): BusyInterval[] {
  return [
    ...studentMeetings.map((row) => ({
      id: row.sessionId ?? meetingKey(row),
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      label: `Aula do aluno · ${row.className}`,
    })),
    ...data.appointments
      .filter((row) => row.studentId === input.studentId)
      .map((row) => ({ ...interval(row), label: "Outro atendimento do aluno" })),
    ...data.visits
      .filter((row) => row.candidate.studentId === input.studentId)
      .map((row) => ({ ...interval(row), label: "Aula experimental do aluno" })),
  ];
}
