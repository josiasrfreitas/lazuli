import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { meetingsBetween, meetingKey, type TeacherMeeting } from "../teachers/schedule.js";
import { COVERAGE_DAYS, dateOnly, linkItem, plusDays, type HomeItem } from "./home-model.js";

const TIME_START = 11;
const TIME_END = 16;
const AGENDA_LIMIT = 8;
type AppointmentRow = {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  student: { fullName: string };
};
type VisitRow = {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  candidateId: string;
  kind: string;
  candidate: { fullName: string };
};
type AgendaRows = {
  meetings: TeacherMeeting[];
  appointments: AppointmentRow[];
  visits: VisitRow[];
};
export type HomeEvent = HomeItem & {
  time: string;
  endTime: string;
  kind: "Aula" | "Atendimento" | "Experimental" | "Nivelamento";
};
function timeOnly(time: Date): string {
  return time.toISOString().slice(TIME_START, TIME_END);
}
export async function readCoverage(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<HomeItem[]> {
  const today = saoPauloDateOnly(now);
  const meetings = await meetingsBetween({
    database,
    from: today,
    through: plusDays(today, COVERAGE_DAYS),
    now,
  });
  return meetings
    .filter(
      (row) => !row.cancelled && responsibleTeacherId(row) === null && sessionEndInstant(row) > now,
    )
    .toSorted(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startTime.localeCompare(right.startTime) ||
        meetingKey(left).localeCompare(meetingKey(right)),
    )
    .map((row) =>
      linkItem({
        id: meetingKey(row),
        title: row.className,
        detail: `${row.startTime} · Definir professor ou substituição`,
        href: `/turmas/${row.classId}`,
        date: row.date,
        timing: { kind: "meeting", date: row.date, startTime: row.startTime, endTime: row.endTime },
      }),
    );
}
export async function readHomeAgenda(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<{ total: number; items: HomeEvent[] }> {
  const today = saoPauloDateOnly(now);
  const date = new Date(today);
  const { meetings, appointments, visits } = await agendaRows(database, { today, date, now });
  const events: HomeEvent[] = [
    ...meetings.filter((row) => !row.cancelled).map((row) => meetingEvent(row)),
    ...appointments.map(
      (row): HomeEvent => ({
        id: row.id,
        title: row.student.fullName,
        detail: "Atendimento pedagógico",
        date: dateOnly(row.date),
        time: timeOnly(row.startTime),
        endTime: timeOnly(row.endTime),
        kind: "Atendimento",
        action: { kind: "appointment", id: row.id },
      }),
    ),
    ...visits.map(
      (row): HomeEvent => ({
        ...linkItem({
          id: row.id,
          title: row.candidate.fullName,
          detail: row.kind === "PLACEMENT" ? "Nivelamento" : "Aula experimental",
          href: `/interessados/${row.candidateId}`,
          date: dateOnly(row.date),
        }),
        time: timeOnly(row.startTime),
        endTime: timeOnly(row.endTime),
        kind: row.kind === "PLACEMENT" ? "Nivelamento" : "Experimental",
      }),
    ),
  ];
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const upcoming = events
    .filter((event) => event.endTime > currentTime)
    .toSorted(
      (left, right) => left.time.localeCompare(right.time) || left.id.localeCompare(right.id),
    );
  return { total: upcoming.length, items: upcoming.slice(0, AGENDA_LIMIT) };
}
function meetingEvent(row: TeacherMeeting): HomeEvent {
  return {
    id: meetingKey(row),
    title: row.className,
    detail: row.substituteTeacherName ?? row.usualTeacherName ?? "Professor a definir",
    date: row.date,
    time: row.startTime,
    endTime: row.endTime,
    kind: "Aula",
    action: row.sessionId
      ? { kind: "lesson", id: row.sessionId }
      : { kind: "link", href: `/turmas/${row.classId}` },
  };
}

async function agendaRows(
  database: Prisma.TransactionClient,
  { today, date, now }: { today: string; date: Date; now: Date },
): Promise<AgendaRows> {
  const [meetings, appointments, visits] = await Promise.all([
    meetingsBetween({ database, from: today, through: today, now }),
    database.pedagogicalAppointment.findMany({
      where: { deletedAt: null, date, status: "SCHEDULED", student: { deletedAt: null } },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        student: { select: { fullName: true } },
      },
    }),
    database.entryVisit.findMany({
      where: {
        deletedAt: null,
        date,
        status: "SCHEDULED",
        candidate: { deletedAt: null, status: "WAITING" },
        OR: [{ classSessionId: null }, { classSession: { status: "SCHEDULED", deletedAt: null } }],
      },
      select: {
        id: true,
        date: true,
        candidateId: true,
        kind: true,
        startTime: true,
        endTime: true,
        candidate: { select: { fullName: true } },
      },
    }),
  ]);
  return { meetings, appointments, visits };
}
