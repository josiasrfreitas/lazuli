import { randomUUID } from "node:crypto";
import { intervalsOverlap, sessionEndInstant, teachingMinutes } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { timeOnly } from "../class-records/data.js";
import { timeStringToDate } from "../classes/time.js";
import {
  assertNoTeacherConflict,
  assertTeacherEligible,
  lockTeacher,
} from "../teachers/availability.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { recordActivity } from "../activity/record.js";
import { dateOnly, type PlanningContext } from "./data.js";
import {
  adjustmentPlanning,
  saveAdjustedProjection,
  adjustmentFingerprint,
} from "./adjustment-data.js";
import type { ExtraClassesInput } from "./adjustment-schema.js";

const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_EXTRA_ENCOUNTERS = 52;
const MINUTES_PER_HOUR = 60;
type CandidateMeeting = { date: string; startTime: string; endTime: string };
type ExtraClassesPreview = {
  fingerprint: string;
  dates: string[];
  skipped: { date: string; reason: string }[];
  outside: number;
  addedMinutes: number;
  remainingMinutes: number;
  availableMinutes: number;
  margin: number;
  uncertain: boolean;
};

function extraDates(input: ExtraClassesInput): string[] {
  const dates: string[] = [];
  for (
    let day = Date.parse(input.from);
    day <= Date.parse(input.through);
    day += MILLISECONDS_PER_DAY
  ) {
    const date = dateOnly(new Date(day));
    if (input.weekdays.some((weekday) => Number(weekday) === new Date(day).getUTCDay() + 1))
      dates.push(date);
  }
  if (dates.length === 0 || dates.length > MAX_EXTRA_ENCOUNTERS)
    throw badRequest("Escolha uma recorrência com 1 a 52 encontros.");
  return dates;
}

async function extraMeetings(
  context: PlanningContext,
  input: ExtraClassesInput,
): Promise<{
  candidates: CandidateMeeting[];
  skipped: ExtraClassesPreview["skipped"];
}> {
  const dates = extraDates(input);
  const closures = await context.database.schoolClosedDay.findMany({
    where: {
      deletedAt: null,
      date: { gte: new Date(input.from), lte: new Date(input.through) },
    },
    select: { date: true, reason: true },
  });
  const skipped = dates.flatMap((date) => {
    const closed = closures.find((row) => dateOnly(row.date) === date);
    return closed ? [{ date, reason: closed.reason }] : [];
  });
  const candidates = dates
    .filter((date) => !skipped.some((row) => row.date === date))
    .map((date) => ({ date, startTime: input.startTime, endTime: input.endTime }));
  return { candidates, skipped };
}

function assertExtraMeetingDates(
  candidates: CandidateMeeting[],
  { planningStart, now }: { planningStart: string; now: Date },
): void {
  if (candidates.some((row) => row.date < planningStart))
    throw badRequest("As aulas extras devem começar a partir do início da programação.");
  if (candidates.length === 0)
    throw badRequest("Todos os encontros coincidem com dias de fechamento.");
  if (
    candidates.some((row) => sessionEndInstant({ date: row.date, endTime: row.startTime }) <= now)
  )
    throw badRequest("Um dos horários já começou. Escolha um início futuro.");
}

export async function previewExtraClasses(
  context: PlanningContext,
  input: ExtraClassesInput,
): Promise<ExtraClassesPreview> {
  const { data, remainingMinutes, uncertain } = await adjustmentPlanning(context, input.classId);
  if (input.from < data.scope.today) throw badRequest("Escolha uma data a partir de hoje.");
  const { candidates, skipped } = await extraMeetings(context, input);
  assertExtraMeetingDates(candidates, {
    planningStart:
      data.plan?.plannedStartOn ?? data.preview?.plannedStartOn ?? data.scope.classStartOn,
    now: context.now,
  });
  await assertTeacherEligible({
    database: context.database,
    teacherId: input.teacherId,
    date: candidates.at(-1)!.date,
  });
  await assertNoTeacherConflict({
    database: context.database,
    teacherId: input.teacherId,
    from: input.from,
    through: input.through,
    slots: [],
    candidateMeetings: candidates,
  });
  await assertRosterAvailable(context, { input, candidates });
  const outside = candidates.filter(
    (row) => row.date < data.scope.semester.startOn || row.date > data.scope.semester.endOn,
  ).length;
  const addedMinutes = candidates.length * teachingMinutes(input);
  return {
    fingerprint: adjustmentFingerprint({
      candidates,
      skipped,
      remainingMinutes,
      version: data.plan?.version,
      records: data.records,
    }),
    dates: candidates.map((row) => row.date),
    skipped,
    outside,
    addedMinutes,
    remainingMinutes,
    availableMinutes: data.calendar.availableMinutes,
    margin: data.calendar.availableMinutes + addedMinutes - remainingMinutes,
    uncertain,
  };
}

export async function scheduleExtraClasses(
  context: PlanningContext,
  input: ExtraClassesInput,
): Promise<{ id: string }> {
  await lockTeacher(context.database, input.teacherId);
  const existing = await context.database.classAppointmentSeries.findUnique({
    where: { id: input.id },
  });
  if (existing) {
    if (existing.classId !== input.classId || existing.scheduledById !== context.staffUser.id)
      throw badRequest("Este agendamento já existe.");
    return { id: existing.id };
  }
  const preview = await previewExtraClasses(context, input);
  if (input.fingerprint !== preview.fingerprint)
    throw badRequest("A programação mudou. Volte e confira os encontros novamente.");
  if (preview.outside > 0 && !input.allowOutsidePeriod)
    throw badRequest("Confirme as aulas extras fora do período letivo.");
  await context.database.classAppointmentSeries.create({
    data: {
      id: input.id,
      classId: input.classId,
      teacherId: input.teacherId,
      scheduledById: context.staffUser.id,
      fromDate: new Date(input.from),
      throughDate: new Date(input.through),
      reason: input.reason,
      schedule: { weekdays: input.weekdays, startTime: input.startTime, endTime: input.endTime },
    },
  });
  const sessions = preview.dates.map((date) => ({
    id: randomUUID(),
    classId: input.classId,
    appointmentSeriesId: input.id,
    date: new Date(date),
    startTime: timeStringToDate(input.startTime),
    endTime: timeStringToDate(input.endTime),
  }));
  await context.database.classSession.createMany({ data: sessions });
  await context.database.classSubstitution.createMany({
    data: sessions.map((session) => ({
      classId: input.classId,
      classSessionId: session.id,
      date: session.date,
      teacherId: input.teacherId,
      recordedById: context.staffUser.id,
      recordedAt: context.now,
    })),
  });
  const name = await context.database.class.findUniqueOrThrow({
    where: { id: input.classId },
    select: { portalClassName: true },
  });
  await recordActivity(context.database, {
    context,
    action: "appointments.scheduleClass",
    details: {
      subject: { type: "class", id: input.classId, name: name.portalClassName },
      description: `${sessions.length} encontros coletivos · ${preview.addedMinutes / MINUTES_PER_HOUR}h · ${input.from} a ${input.through}. ${input.reason}`,
    },
  });
  await saveAdjustedProjection(context, { classId: input.classId, reason: input.reason });
  return { id: input.id };
}

type RosterEnrollment = { studentId: string; entryDate: Date; exitDate: Date | null };
type StudentEncounter = { studentId: string | null; date: Date; startTime: Date; endTime: Date };
type RosterSchedule = {
  enrollments: RosterEnrollment[];
  others: (RosterEnrollment & { classId: string })[];
  meetings: Awaited<ReturnType<typeof meetingsBetween>>;
  encounters: StudentEncounter[];
};

async function readRosterSchedule(
  context: PlanningContext,
  input: ExtraClassesInput,
): Promise<RosterSchedule> {
  const enrollments = await context.database.enrollment.findMany({
    where: {
      classId: input.classId,
      deletedAt: null,
      student: { deletedAt: null },
      entryDate: { lte: new Date(input.through) },
      OR: [{ exitDate: null }, { exitDate: { gt: new Date(input.from) } }],
    },
    select: { studentId: true, entryDate: true, exitDate: true },
  });
  const studentIds = enrollments.map((row) => row.studentId);
  const others = await context.database.enrollment.findMany({
    where: { studentId: { in: studentIds }, deletedAt: null },
    select: { classId: true, studentId: true, entryDate: true, exitDate: true },
  });
  const appointments = await context.database.pedagogicalAppointment.findMany({
    where: {
      studentId: { in: studentIds },
      deletedAt: null,
      status: { not: "CANCELLED" },
      date: { gte: new Date(input.from), lte: new Date(input.through) },
    },
    select: { studentId: true, date: true, startTime: true, endTime: true },
  });
  const visits = await context.database.entryVisit.findMany({
    where: {
      candidate: { studentId: { in: studentIds } },
      deletedAt: null,
      status: { not: "CANCELLED" },
      date: { gte: new Date(input.from), lte: new Date(input.through) },
    },
    select: {
      candidate: { select: { studentId: true } },
      date: true,
      startTime: true,
      endTime: true,
    },
  });
  const meetings = await meetingsBetween({
    database: context.database,
    from: input.from,
    through: input.through,
    now: context.now,
  });
  return {
    enrollments,
    others,
    meetings,
    encounters: [
      ...appointments,
      ...visits.map((row) => ({ ...row, studentId: row.candidate.studentId })),
    ],
  };
}

function activeEnrollment(row: RosterEnrollment, date: string): boolean {
  return dateOnly(row.entryDate) <= date && (!row.exitDate || dateOnly(row.exitDate) > date);
}

async function assertRosterAvailable(
  context: PlanningContext,
  { input, candidates }: { input: ExtraClassesInput; candidates: CandidateMeeting[] },
): Promise<void> {
  const { enrollments, others, meetings, encounters } = await readRosterSchedule(context, input);
  for (const candidate of candidates) {
    const roster = new Set(
      enrollments
        .filter((row) => activeEnrollment(row, candidate.date))
        .map((row) => row.studentId),
    );
    if (roster.size === 0)
      throw badRequest(`A turma não tem alunos matriculados em ${candidate.date}.`);
    const classes = new Set(
      others
        .filter((row) => roster.has(row.studentId) && activeEnrollment(row, candidate.date))
        .map((row) => row.classId),
    );
    const meeting = meetings.find(
      (row) =>
        classes.has(row.classId) && row.date === candidate.date && intervalsOverlap(candidate, row),
    );
    if (
      meeting ||
      encounters.some(
        (row) =>
          row.studentId &&
          roster.has(row.studentId) &&
          dateOnly(row.date) === candidate.date &&
          intervalsOverlap(candidate, {
            startTime: timeOnly(row.startTime),
            endTime: timeOnly(row.endTime),
          }),
      )
    )
      throw badRequest(
        `Há conflito na agenda dos alunos em ${candidate.date.split("-").toReversed().join("/")}. Escolha outro horário.`,
      );
  }
}
