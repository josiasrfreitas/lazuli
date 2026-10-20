import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, sessionEndInstant } from "@lazuli/domain";
import type { entryVisitCalendarSchema, z } from "@lazuli/validators";
import { dateToTimeString } from "../classes/time.js";
import { meetingsBetween, meetingKey } from "../teachers/schedule.js";
import { badRequest } from "../trpc/errors.js";
import { dateOnly, readCandidate } from "./candidates.js";
import { candidateVisits } from "./visit-read.js";

export async function visitCalendar(
  database: Prisma.TransactionClient,
  input: z.infer<typeof entryVisitCalendarSchema>,
  now: Date,
) {
  const candidate = await readCandidate(database, input.candidateId);
  if (candidate.status !== "WAITING")
    throw badRequest("Reabra o lead para agendar uma experimental.");
  const date = { gte: new Date(input.from), lte: new Date(input.through) };
  const [meetings, visits, closed, appointments, introductions] = await Promise.all([
    meetingsBetween({ database, from: input.from, through: input.through, now }),
    candidateVisits(database, { id: candidate.id, now }),
    database.schoolClosedDay.findMany({
      where: { date, deletedAt: null },
      select: { date: true, reason: true },
    }),
    input.teacherId
      ? database.pedagogicalAppointment.findMany({
          where: {
            date,
            teacherId: input.teacherId,
            deletedAt: null,
            status: { not: "CANCELLED" },
            targetClassSessionId: null,
          },
          select: { id: true, date: true, startTime: true, endTime: true },
        })
      : [],
    input.teacherId
      ? database.entryVisit.findMany({
          where: {
            date,
            teacherId: input.teacherId,
            kind: "INTRODUCTION",
            deletedAt: null,
            status: { not: "CANCELLED" },
            ...(input.previousVisitId ? { id: { not: input.previousVisitId } } : {}),
          },
          select: { id: true, date: true, startTime: true, endTime: true },
        })
      : [],
  ]);
  const interval = (row: { id: string; date: Date; startTime: Date; endTime: Date }) => ({
    id: row.id,
    date: dateOnly(row.date),
    startTime: dateToTimeString(row.startTime),
    endTime: dateToTimeString(row.endTime),
  });
  // Individual trials also need ongoing classes to block teacher conflicts.
  return {
    meetings: meetings
      .filter(
        (row) =>
          !row.cancelled &&
          responsibleTeacherId(row) &&
          (input.teacherId ||
            sessionEndInstant({ date: row.date, endTime: row.startTime }) > now) &&
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
      })),
    leadBusy: visits
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
      })),
    teacherBusy: [
      ...appointments.map((row) => ({ ...interval(row), label: "Atendimento do professor" })),
      ...introductions.map((row) => ({ ...interval(row), label: "Experimental individual" })),
    ],
    closedDays: closed.map((row) => ({ date: dateOnly(row.date), reason: row.reason })),
  };
}
