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

/** Class, schedule-slot, and held-session upserts for the dev seed. */

const WEEKDAYS_BY_JS_DAY: readonly DevWeekday[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const WEEKDAY_PORTAL_ABBREVIATIONS: ReadonlyMap<DevWeekday, string> = new Map([
  ["MONDAY", "SEG"],
  ["TUESDAY", "TER"],
  ["WEDNESDAY", "QUA"],
  ["THURSDAY", "QUI"],
  ["FRIDAY", "SEX"],
  ["SATURDAY", "SAB"],
  ["SUNDAY", "DOM"],
]);

const DAYS_PER_WEEK = 7;
const YEAR_SUFFIX_LENGTH = 2;

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
  await context.database.class.upsert({
    where: { id: classId },
    create: {
      id: classId,
      internalCode: `${context.semester.name}-${classSeed.key}`,
      teacherId,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stage.id,
      semesterId: context.semester.id,
      year: context.semester.year,
      capacity: classSeed.capacity,
      portalClassName: portalClassNameFor({ classSeed, semesterName: context.semester.name }),
    },
    update: { teacherId, capacity: classSeed.capacity },
  });
  const sessions = await seedClassSessions(context, { classSeed, classId, teacherId });
  context.classes.set(classSeed.key, { id: classId, teacherId, stageId: stage.id, sessions });
}

function portalClassNameFor(input: { classSeed: DevClassSeed; semesterName: string }): string {
  const primarySlot = requireValue(input.classSeed.slots[0], "schedule slot");
  const weekday = WEEKDAY_PORTAL_ABBREVIATIONS.get(primarySlot.weekday) ?? primarySlot.weekday;
  const [year = "", half = ""] = input.semesterName.split(".");
  const slotWindow = `${primarySlot.startTime}/${primarySlot.endTime}`;
  const suffix = `${half}S/${year.slice(-YEAR_SUFFIX_LENGTH)}-1`;
  return `REG/${input.classSeed.stageInternalCode}-${weekday}-${slotWindow}-${suffix}`;
}

type ClassSessionsInput = { classSeed: DevClassSeed; classId: string; teacherId: string };

async function seedClassSessions(
  context: SeedContext,
  input: ClassSessionsInput,
): Promise<SeededSession[]> {
  const occurrences: Array<{ dateIso: string; slot: DevScheduleSlot; slotId: string }> = [];
  for (const slot of input.classSeed.slots) {
    const slotId = await upsertScheduleSlot(context, { classId: input.classId, slot });
    for (const dateIso of slotOccurrences(context, slot.weekday)) {
      occurrences.push({ dateIso, slot, slotId });
    }
  }
  occurrences.sort((left, right) => left.dateIso.localeCompare(right.dateIso));

  const sessions: SeededSession[] = [];
  for (const [index, occurrence] of occurrences.entries()) {
    sessions.push(await upsertSession(context, { ...occurrence, ...input, index }));
  }
  return sessions;
}

async function upsertScheduleSlot(
  context: SeedContext,
  input: { classId: string; slot: DevScheduleSlot },
): Promise<string> {
  const id = stableUuid(["slot", input.classId, input.slot.weekday, input.slot.startTime]);
  await context.database.classScheduleSlot.upsert({
    where: { id },
    create: {
      id,
      classId: input.classId,
      weekday: input.slot.weekday,
      startTime: timeOfDay(input.slot.startTime),
      endTime: timeOfDay(input.slot.endTime),
    },
    update: {},
  });
  return id;
}

function slotOccurrences(context: SeedContext, weekday: DevWeekday): string[] {
  const start = utcDate(context.semester.startIso);
  const end = utcDate(context.todayIso);
  const offset =
    (WEEKDAYS_BY_JS_DAY.indexOf(weekday) - start.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const occurrences: string[] = [];
  for (let cursor = addDays(start, offset); cursor < end; cursor = addDays(cursor, DAYS_PER_WEEK)) {
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

async function upsertSession(context: SeedContext, input: SessionInput): Promise<SeededSession> {
  const id = stableUuid(["session", input.classId, input.dateIso, input.slot.startTime]);
  const confirmedAt = endOfDayUtc(input.dateIso);
  await context.database.classSession.upsert({
    where: { id },
    create: {
      id,
      classId: input.classId,
      scheduleSlotId: input.slotId,
      date: utcDate(input.dateIso),
      startTime: timeOfDay(input.slot.startTime),
      endTime: timeOfDay(input.slot.endTime),
      attendanceConfirmedAt: confirmedAt,
      attendanceConfirmedById: input.teacherId,
      attendanceLastCommittedAt: confirmedAt,
    },
    update: {},
  });
  return { id, dateIso: input.dateIso, index: input.index };
}
