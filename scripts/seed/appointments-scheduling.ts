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
  const dates = Array.from({ length: 21 }, (_, index) =>
    scenarioDate(context.todayIso, input.future ? index + 1 : index - 21),
  ).filter(
    (date) =>
      date.getUTCDay() !== 0 &&
      date.getUTCDay() !== 6 &&
      date >= input.enrollment.entryDate &&
      (!input.enrollment.exitDate || date < input.enrollment.exitDate) &&
      (!input.afterDate || date > input.afterDate),
  );
  const latestScheduledAt = businessInstant(
    previousWeekday(scenarioDate(context.todayIso, 0)),
    "10:00",
  );
  dates.sort(
    (left, right) =>
      Number(right.getUTCDay() === 5) - Number(left.getUTCDay() === 5) ||
      left.getTime() - right.getTime(),
  );
  const teachers = [...context.teachers].sort(
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
    for (const start of ["15:00", "17:30", "10:00", "11:00"]) {
      const startTime = timeOfDay(start);
      const endTime = new Date(startTime.getTime() + input.minutes * 60_000);
      if (scheduledAt >= businessInstant(date, start)) continue;
      if (!(await studentIsFree(context, input.enrollment.studentId, { date, startTime, endTime })))
        continue;
      for (const teacher of teachers) {
        if (!(await teacherIsFree(context, teacher.id, { date, startTime, endTime }))) continue;
        return { date, startTime, endTime, teacherId: teacher.id, scheduledAt };
      }
    }
  }
  return null;
}

async function teacherIsFree(
  context: AppointmentSeedContext,
  teacherId: string,
  slot: { date: Date; startTime: Date; endTime: Date },
): Promise<boolean> {
  const date = isoOf(slot.date);
  const candidate = {
    date,
    startTime: slot.startTime.toISOString().slice(11, 16),
    endTime: slot.endTime.toISOString().slice(11, 16),
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
  studentId: string,
  slot: { date: Date; startTime: Date; endTime: Date },
): Promise<boolean> {
  const overlap = { startTime: { lt: slot.endTime }, endTime: { gt: slot.startTime } };
  const conflicts = await Promise.all([
    context.database.classSession.count({
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
    }),
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

export function appointmentEndedAt(slot: AppointmentSeedSlot): Date {
  return businessInstant(slot.date, slot.endTime.toISOString().slice(11, 16));
}

export function cancellationInstant(slot: AppointmentSeedSlot): Date {
  return new Date(slot.scheduledAt.getTime() + 60 * 60_000);
}
