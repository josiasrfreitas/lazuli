import type { DevClassSeed, DevScheduleSlot, DevWeekday } from "./seed-dev-data.js";
import {
  addDays,
  endOfDayUtc,
  isoOf,
  requireValue,
  stableUuid,
  timeOfDay,
  utcDate,
  type SeedContext,
  type SeededSession,
} from "./seed-dev-support.js";

/** Class schedules, teacher assignments and sessions for a fresh school dataset. */

const WEEKDAYS_BY_JS_DAY: readonly DevWeekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const DAYS_PER_WEEK = 7;

export async function seedClass(context: SeedContext, classSeed: DevClassSeed): Promise<void> {
  const teacherId = requireValue(
    context.teacherIds.get(classSeed.teacherKey),
    `teacher ${classSeed.teacherKey}`,
  );
  const stage = requireValue(
    (await context.database.stage.findFirst({
      where: { internalCode: classSeed.stageInternalCode },
    })) ?? undefined,
    `stage ${classSeed.stageInternalCode}`,
  );
  const classId = stableUuid(["class", classSeed.key]);
  const portalClassName = await context.resolveClassName(classSeed, context.semester);
  await context.database.class.create({
    data: {
      id: classId,
      internalCode: `${context.semester.name}-${classSeed.key}`,
      teacherId,
      scheduleType: classSeed.scheduleType ?? "REGULAR",
      format: "IN_PERSON",
      sharedStageId: classSeed.scheduleType === "PERSONALIZED" ? null : stage.id,
      semesterId: context.semester.id,
      year: context.semester.year,
      capacity: classSeed.capacity,
      portalClassName,
      originalPortalClassName: portalClassName,
      teacherAssignments: {
        create: { teacherId, effectiveDate: utcDate(context.semester.startIso) },
      },
    },
  });
  const sessions = await seedClassSessions(context, { classSeed, classId, teacherId });
  context.classes.set(classSeed.key, { id: classId, teacherId, stageId: stage.id, sessions });
}

type ClassSessionsInput = { classSeed: DevClassSeed; classId: string; teacherId: string };

async function seedClassSessions(
  context: SeedContext,
  input: ClassSessionsInput,
): Promise<SeededSession[]> {
  const occurrences: Array<{ dateIso: string; slot: DevScheduleSlot; slotId: string }> = [];
  for (const slot of input.classSeed.slots) {
    const slotId = await createScheduleSlot(context, { classId: input.classId, slot });
    for (const dateIso of slotOccurrences(context, slot.weekday)) {
      occurrences.push({ dateIso, slot, slotId });
    }
  }
  occurrences.sort((left, right) => left.dateIso.localeCompare(right.dateIso));

  const sessions: SeededSession[] = [];
  for (const [index, occurrence] of occurrences.entries()) {
    const session = await createSession(context, { ...occurrence, ...input, index });
    if (session.dateIso < context.todayIso) sessions.push(session);
  }
  return sessions;
}

async function createScheduleSlot(
  context: SeedContext,
  input: { classId: string; slot: DevScheduleSlot },
): Promise<string> {
  const id = stableUuid(["slot", input.classId, input.slot.weekday, input.slot.startTime]);
  await context.database.classScheduleSlot.create({
    data: {
      id,
      classId: input.classId,
      weekday: input.slot.weekday,
      startTime: timeOfDay(input.slot.startTime),
      endTime: timeOfDay(input.slot.endTime),
    },
  });
  return id;
}

function slotOccurrences(context: SeedContext, weekday: DevWeekday): string[] {
  const start = utcDate(context.semester.startIso);
  const end = utcDate(context.semester.endIso);
  const offset =
    (WEEKDAYS_BY_JS_DAY.indexOf(weekday) - start.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const occurrences: string[] = [];
  for (
    let cursor = addDays(start, offset);
    cursor <= end;
    cursor = addDays(cursor, DAYS_PER_WEEK)
  ) {
    occurrences.push(isoOf(cursor));
  }
  return occurrences;
}

type SessionInput = ClassSessionsInput & {
  dateIso: string;
  slot: DevScheduleSlot;
  slotId: string;
  index: number;
};

async function createSession(context: SeedContext, input: SessionInput): Promise<SeededSession> {
  const id = stableUuid(["session", input.classId, input.dateIso, input.slot.startTime]);
  const confirmedAt = input.dateIso < context.todayIso ? endOfDayUtc(input.dateIso) : null;
  await context.database.classSession.create({
    data: {
      id,
      classId: input.classId,
      scheduleSlotId: input.slotId,
      date: utcDate(input.dateIso),
      startTime: timeOfDay(input.slot.startTime),
      endTime: timeOfDay(input.slot.endTime),
      attendanceConfirmedAt: confirmedAt,
      attendanceConfirmedById: confirmedAt ? input.teacherId : null,
      attendanceLastCommittedAt: confirmedAt,
    },
  });
  return { id, dateIso: input.dateIso, index: input.index };
}
