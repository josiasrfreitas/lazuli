import { assertNoIntroductionConflict } from "../admissions/teacher-commitments.js";
import { hasTeacherIdentity } from "./identity.js";
import { assertNoAppointmentConflict } from "../appointments/commitments.js";
import type { Prisma } from "@lazuli/db";
import {
  intervalsOverlap,
  weekdayOf,
  responsibleTeacherId,
  saoPauloDateOnly,
} from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";
import { dateToTimeString } from "../classes/time.js";
import { meetingKey, meetingsBetween } from "./schedule.js";
const ISO_DATE_LENGTH = 10;
const DAY_MILLISECONDS = 86_400_000;

export type CandidateSlot = { weekday: string; startTime: string; endTime: string };
const dateOnly = (date: Date): string => date.toISOString().slice(0, ISO_DATE_LENGTH);

export async function lockTeacher(
  database: Prisma.TransactionClient,
  _teacherId: string,
): Promise<void> {
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"lazuli:teaching-schedule"}, 158))`;
}

export async function assertTeacherEligible(
  input: AssertTeacherEligibleInput,
): Promise<Date | null> {
  const teacher = await input.database.user.findUnique({
    where: { id: input.teacherId },
    select: {
      role: true,
      deletedAt: true,
      teacherProfile: { select: { departureDate: true, deletedAt: true } },
    },
  });
  if (
    !teacher ||
    !hasTeacherIdentity(teacher) ||
    teacher.deletedAt ||
    (teacher.teacherProfile?.departureDate &&
      dateOnly(teacher.teacherProfile.departureDate) <= input.date)
  ) {
    throw badRequest("Professor não está em atuação na data escolhida.");
  }
  return teacher.teacherProfile?.departureDate ?? null;
}

export async function assertNoTeacherConflict(input: AssertNoTeacherConflictInput): Promise<void> {
  await assertNoIntroductionConflict(input);
  await assertNoAppointmentConflict(input);
  const meetings = await meetingsBetween({
    database: input.database,
    from: input.from,
    through: input.through,
  });
  for (const meeting of meetings) {
    if (meeting.cancelled || responsibleTeacherId(meeting) !== input.teacherId) continue;
    if (meeting.classId === input.excludeClassId) continue;
    if (input.excludeMeeting && meetingKey(meeting) === meetingKey(input.excludeMeeting)) continue;
    const slot = input.candidateMeetings
      ? input.candidateMeetings.find(
          (item) => item.date === meeting.date && intervalsOverlap(item, meeting),
        )
      : input.slots.find(
          (item) => item.weekday === weekdayOf(meeting.date) && intervalsOverlap(item, meeting),
        );
    if (slot)
      throw badRequest(
        `Conflito com ${meeting.classCode}, ${meeting.date.split("-").toReversed().join("/")}, ${meeting.startTime}–${meeting.endTime}.`,
      );
  }
}

export function databaseSlotToCandidate(slot: DatabaseSlotToCandidateInput): CandidateSlot {
  return {
    weekday: slot.weekday,
    startTime: dateToTimeString(slot.startTime),
    endTime: dateToTimeString(slot.endTime),
  };
}

export async function assertClassTeacherAvailable(
  input: AssertClassTeacherAvailableInput,
): Promise<{ id: string; name: string; startDate: Date; endDate: Date }> {
  await lockTeacher(input.database, input.teacherId);
  const semester = await input.database.period.findUnique({
    where: { id: input.semesterId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!semester) throw badRequest("Semestre não encontrado.");
  const startDate = input.startDate ?? dateOnly(semester.startDate);
  if (startDate < dateOnly(semester.startDate) || startDate > dateOnly(semester.endDate)) {
    throw badRequest("A data de início da turma deve estar dentro do período.");
  }
  const departureDate = await assertTeacherEligible({
    database: input.database,
    teacherId: input.teacherId,
    date: [startDate, saoPauloDateOnly(new Date())].toSorted().at(-1)!,
  });
  for (const [index, slot] of input.slots.entries()) {
    if (
      input.slots
        .slice(index + 1)
        .some((other) => slot.weekday === other.weekday && intervalsOverlap(slot, other))
    )
      throw badRequest(
        `A própria turma tem horários sobrepostos: ${slot.startTime}–${slot.endTime}.`,
      );
  }
  const end = departureDate
    ? new Date(Math.min(semester.endDate.getTime(), departureDate.getTime() - DAY_MILLISECONDS))
    : semester.endDate;
  await assertNoTeacherConflict({
    ...input,
    from: startDate,
    through: dateOnly(end),
  });
  return semester;
}

type AssertTeacherEligibleInput = {
  database: Prisma.TransactionClient;
  teacherId: string;
  date: string;
};
type AssertNoTeacherConflictInput = {
  database: Prisma.TransactionClient;
  teacherId: string;
  from: string;
  through: string;
  slots: readonly CandidateSlot[];
  candidateMeetings?: readonly { date: string; startTime: string; endTime: string }[];
  excludeClassId?: string;
  excludeAppointmentId?: string;
  excludeMeeting?: {
    classId: string;
    slotId: string | null;
    sessionId?: string | null;
    date: string;
  };
};
type DatabaseSlotToCandidateInput = {
  weekday: string;
  startTime: Date;
  endTime: Date;
};
type AssertClassTeacherAvailableInput = {
  database: Prisma.TransactionClient;
  teacherId: string;
  semesterId: string;
  startDate?: string;
  slots: readonly CandidateSlot[];
};
