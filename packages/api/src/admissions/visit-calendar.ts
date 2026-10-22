import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, sessionEndInstant } from "@lazuli/domain";
import type { entryVisitCalendarSchema, z } from "@lazuli/validators";
import { dateToTimeString } from "../classes/time.js";
import { meetingsBetween, meetingKey, type TeacherMeeting } from "../teachers/schedule.js";
import { badRequest } from "../trpc/errors.js";
import { dateOnly, readCandidate } from "./candidates.js";
import { candidateVisits, type CandidateVisit } from "./visit-read.js";

type CalendarInput = z.infer<typeof entryVisitCalendarSchema>;
type TimedRow = { id: string; date: Date; startTime: Date; endTime: Date };
type BusyInterval = { id: string; date: string; startTime: string; endTime: string; label: string };
type VisitCalendarResult = {
  meetings: Array<
    Pick<
      TeacherMeeting,
      "classId" | "className" | "date" | "startTime" | "endTime" | "format" | "stageName"
    > & {
      id: string;
      scheduleSlotId: string | null;
      classSessionId: string | null;
      teacherName: string | null;
    }
  >;
  leadBusy: BusyInterval[];
  teacherBusy: BusyInterval[];
  closedDays: { date: string; reason: string }[];
};

export async function visitCalendar(
  database: Prisma.TransactionClient,
  options: {
    input: CalendarInput;
    now: Date;
  },
): Promise<VisitCalendarResult> {
  const { input, now } = options;

  const candidate = await readCandidate(database, input.candidateId);
  if (candidate.status !== "WAITING")
    throw badRequest("Reabra o lead para agendar uma experimental.");
  const [meetings, visits, closed, appointments, introductions] = await Promise.all([
    meetingsBetween({ database, from: input.from, through: input.through, now }),
    candidateVisits(database, { id: candidate.id, now }),
    database.schoolClosedDay.findMany({
      where: { date: { gte: new Date(input.from), lte: new Date(input.through) }, deletedAt: null },
      select: { date: true, reason: true },
    }),
    teacherAppointments(database, input),
    teacherIntroductions(database, input),
  ]);
  // Individual trials also need ongoing classes to block teacher conflicts.
  return {
    meetings: availableMeetings(meetings, { input, now }),
    leadBusy: leadBusyIntervals(visits, input),
    teacherBusy: [
      ...appointments.map((row) => ({ ...timedInterval(row), label: "Atendimento do professor" })),
      ...introductions.map((row) => ({ ...timedInterval(row), label: "Experimental individual" })),
    ],
    closedDays: closed.map((row) => ({ date: dateOnly(row.date), reason: row.reason })),
  };
}

async function teacherAppointments(
  database: Prisma.TransactionClient,
  input: CalendarInput,
): Promise<TimedRow[]> {
  if (!input.teacherId) return [];
  return database.pedagogicalAppointment.findMany({
    where: {
      date: { gte: new Date(input.from), lte: new Date(input.through) },
      teacherId: input.teacherId,
      deletedAt: null,
      status: { not: "CANCELLED" },
      targetClassSessionId: null,
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
}

async function teacherIntroductions(
  database: Prisma.TransactionClient,
  input: CalendarInput,
): Promise<TimedRow[]> {
  if (!input.teacherId) return [];
  return database.entryVisit.findMany({
    where: {
      date: { gte: new Date(input.from), lte: new Date(input.through) },
      teacherId: input.teacherId,
      kind: "INTRODUCTION",
      deletedAt: null,
      status: { not: "CANCELLED" },
      ...(input.previousVisitId ? { id: { not: input.previousVisitId } } : {}),
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  });
}

function timedInterval(row: TimedRow): Omit<BusyInterval, "label"> {
  return {
    id: row.id,
    date: dateOnly(row.date),
    startTime: dateToTimeString(row.startTime),
    endTime: dateToTimeString(row.endTime),
  };
}

function availableMeetings(
  meetings: TeacherMeeting[],
  { input, now }: { input: CalendarInput; now: Date },
): VisitCalendarResult["meetings"] {
  return meetings
    .filter(
      (row) =>
        !row.cancelled &&
        responsibleTeacherId(row) &&
        (input.teacherId || sessionEndInstant({ date: row.date, endTime: row.startTime }) > now) &&
        (!input.teacherId || responsibleTeacherId(row) === input.teacherId),
    )
    .map((row) => ({
      id: meetingKey(row),
      classId: row.classId,
      className: row.className,
      scheduleSlotId: row.slotId,
      classSessionId: row.sessionId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      format: row.format,
      stageName: row.stageName,
      teacherName: row.substituteTeacherName ?? row.usualTeacherName,
    }));
}

function leadBusyIntervals(visits: CandidateVisit[], input: CalendarInput): BusyInterval[] {
  return visits
    .filter(
      (row) =>
        row.id !== input.previousVisitId &&
        row.status !== "CANCELLED" &&
        dateOnly(row.date) >= input.from &&
        dateOnly(row.date) <= input.through,
    )
    .map((row) => ({
      id: row.id,
      date: dateOnly(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      label: row.kind === "PLACEMENT" ? "Nivelamento do lead" : "Experimental do lead",
    }));
}
