import {
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../../packages/api/src/teachers/availability.js";
import { isoOf, timeOfDay } from "../../packages/db/src/seed-dev-support.js";
import {
  businessInstant,
  previousWeekday,
  scenarioDate,
  type AppointmentEnrollment,
  type AppointmentSeedContext,
} from "./appointments-data.js";

const MILLISECONDS_PER_MINUTE = 60_000;
const SEARCH_WINDOW_DAYS = 21;
const FRIDAY = 5;
const SATURDAY = 6;
const MINUTES_PER_HOUR = 60;
type AppointmentInterval = { date: Date; startTime: Date; endTime: Date };
const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

export type AppointmentSeedSlot = {
  date: Date;
  startTime: Date;
  endTime: Date;
  teacherId: string;
  scheduledAt: Date;
};
type SlotRequest = {
  enrollment: AppointmentEnrollment;
  minutes: number;
  future: boolean;
  afterSource: Date;
  afterDate?: Date;
  scheduledAt?: Date;
};

/** Prefer Friday support hours, with safe weekday alternatives rather than overlapping commitments. */
export async function findAppointmentSlot(
  context: AppointmentSeedContext,
  input: SlotRequest,
): Promise<AppointmentSeedSlot | null> {
  const dates = appointmentDates(context, input);
  const latestScheduledAt = businessInstant(
    previousWeekday(scenarioDate(context.todayIso, 0)),
    "10:00",
  );
  dates.sort(
    (left, right) =>
      Number(right.getUTCDay() === FRIDAY) - Number(left.getUTCDay() === FRIDAY) ||
      left.getTime() - right.getTime(),
  );
  const teachers = [...context.teachers].toSorted(
    (left, right) =>
      Number(right.id === input.enrollment.class.teacherId) -
      Number(left.id === input.enrollment.class.teacherId),
  );
  for (const date of dates) {
    const usualScheduledAt = businessInstant(previousWeekday(date), "10:00");
    const scheduledAt =
      input.scheduledAt ??
      new Date(Math.min(usualScheduledAt.getTime(), latestScheduledAt.getTime()));
    if (scheduledAt <= input.afterSource) continue;
    const closed = await context.database.schoolClosedDay.count({
      where: { date, deletedAt: null },
    });
    if (closed) continue;
    const slot = await appointmentOnDate(context, { request: input, date, scheduledAt, teachers });
    if (slot) return slot;
  }
  return null;
}

function appointmentDates(context: AppointmentSeedContext, input: SlotRequest): Date[] {
  return Array.from({ length: SEARCH_WINDOW_DAYS }, (_unused, index) =>
    scenarioDate(context.todayIso, input.future ? index + 1 : index - SEARCH_WINDOW_DAYS),
  ).filter(
    (date) =>
      date.getUTCDay() !== 0 &&
      date.getUTCDay() !== SATURDAY &&
      date >= input.enrollment.entryDate &&
      (!input.enrollment.exitDate || date < input.enrollment.exitDate) &&
      (!input.afterDate || date > input.afterDate),
  );
}

async function appointmentOnDate(
  context: AppointmentSeedContext,
  input: {
    request: SlotRequest;
    date: Date;
    scheduledAt: Date;
    teachers: AppointmentSeedContext["teachers"];
  },
): Promise<AppointmentSeedSlot | null> {
  const { request, date, scheduledAt, teachers } = input;
  for (const start of ["15:00", "17:30", "10:00", "11:00"]) {
    const startTime = timeOfDay(start);
    const endTime = new Date(startTime.getTime() + request.minutes * MILLISECONDS_PER_MINUTE);
    if (scheduledAt >= businessInstant(date, start)) continue;
    const slot = { date, startTime, endTime };
    if (!(await studentIsFree(context, { studentId: request.enrollment.studentId, slot })))
      continue;
    for (const teacher of teachers) {
      if (!(await teacherIsFree(context, { teacherId: teacher.id, slot }))) continue;
      return { date, startTime, endTime, teacherId: teacher.id, scheduledAt };
    }
  }
  return null;
}

async function teacherIsFree(
  context: AppointmentSeedContext,
  input: { teacherId: string; slot: AppointmentInterval },
): Promise<boolean> {
  const { teacherId, slot } = input;
  const date = isoOf(slot.date);
  const candidate = {
    date,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  };
  try {
    await assertTeacherEligible({ database: context.database, teacherId, date });
    await assertNoTeacherConflict({
      database: context.database,
      teacherId,
      from: date,
      through: date,
      slots: [],
      candidateMeetings: [candidate],
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "BAD_REQUEST") return false;
    throw error;
  }
  return true;
}

async function studentIsFree(
  context: AppointmentSeedContext,
  input: { studentId: string; slot: AppointmentInterval },
): Promise<boolean> {
  const { studentId, slot } = input;
  const overlap = { startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime } };
  const conflicts = await Promise.all([
    classSessionConflicts(context, { studentId, slot, overlap }),
    context.database.pedagogicalAppointment.count({
      where: {
        studentId,
        date: slot.date,
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...overlap,
      },
    }),
    context.database.makeup.count({
      where: {
        deletedAt: null,
        cancelledAt: null,
        originEnrollment: { studentId },
        targetClassSession: { date: slot.date, deletedAt: null, status: "SCHEDULED", ...overlap },
      },
    }),
    context.database.entryVisit.count({
      where: {
        date: slot.date,
        deletedAt: null,
        status: { not: "CANCELLED" },
        candidate: { studentId },
        ...overlap,
      },
    }),
  ]);
  return conflicts.every((count) => count === 0);
}

function classSessionConflicts(
  context: AppointmentSeedContext,
  input: {
    studentId: string;
    slot: AppointmentInterval;
    overlap: { startTime: { lt: Date }; endTime: { gt: Date } };
  },
): Promise<number> {
  const { studentId, slot, overlap } = input;
  return context.database.classSession.count({
    where: {
      date: slot.date,
      deletedAt: null,
      status: "SCHEDULED",
      ...overlap,
      class: {
        enrollments: {
          some: {
            studentId,
            deletedAt: null,
            entryDate: { lte: slot.date },
            OR: [{ exitDate: null }, { exitDate: { gt: slot.date } }],
          },
        },
      },
    },
  });
}

export function appointmentEndedAt(slot: AppointmentSeedSlot): Date {
  return businessInstant(
    slot.date,
    slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  );
}

export function cancellationInstant(slot: AppointmentSeedSlot): Date {
  return new Date(slot.scheduledAt.getTime() + MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE);
}
