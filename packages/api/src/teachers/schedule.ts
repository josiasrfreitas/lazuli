import { introductoryMeetings } from "../admissions/teacher-commitments.js";
import { teachingMinutes } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, saoPauloDateOnly, weekdayOf, weekDates } from "@lazuli/domain";
import { loadScheduleData, type ScheduleClass, type ScheduleData } from "./schedule-data.js";
import {
  meetingKey,
  projectMeeting,
  type TeacherMeeting,
  type MeetingCandidate,
  type ProjectionContext,
} from "./schedule-projection.js";

export { meetingKey, type TeacherMeeting } from "./schedule-projection.js";

const ISO_DATE_LENGTH = 10;
const DAY_MILLISECONDS = 86_400_000;
const LAST_WEEK_DAY = 6;
const dateOnly = (value: Date): string => value.toISOString().slice(0, ISO_DATE_LENGTH);
const utcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
function recordedMeetingKey(row: RecordedMeetingKeyInput, sessionId: string | null): string {
  return meetingKey({
    classId: row.classId,
    slotId: row.scheduleSlotId,
    sessionId,
    date: dateOnly(row.date),
  });
}
function projectionContext(data: ScheduleData, now: Date): ProjectionContext {
  const substitutions: ProjectionContext["substitutions"] = new Map();
  // An active coverage wins over an audit row, even when timestamps tie.
  for (const row of data.substitutions) {
    const key = recordedMeetingKey(row, row.classSessionId);
    if (!substitutions.has(key) || !row.revokedAt || substitutions.get(key)?.revokedAt)
      substitutions.set(key, row);
  }
  return {
    closed: new Set(data.closedDays.map((row) => dateOnly(row.date))),
    sessions: new Map(data.sessions.map((row) => [recordedMeetingKey(row, row.id), row])),
    substitutions,
    now,
  };
}
function classCandidates(
  classRow: ScheduleClass,
  input: ClassCandidatesContext,
): MeetingCandidate[] {
  const result: MeetingCandidate[] = [];
  const start = Math.max(input.range.gte.getTime(), classRow.semester.startDate.getTime());
  const end = Math.min(input.range.lte.getTime(), classRow.semester.endDate.getTime());
  for (let day = start; day <= end; day += DAY_MILLISECONDS) {
    const date = dateOnly(new Date(day));
    if (classRow.status === "ARCHIVED" && date >= saoPauloDateOnly(input.now)) continue;
    for (const slot of classRow.scheduleSlots) {
      if (slot.weekday === weekdayOf(date))
        result.push({
          classRow,
          date,
          slotId: slot.id,
          sessionId: null,
          start: slot.startTime,
          end: slot.endTime,
        });
    }
  }
  for (const session of input.sessions.filter((row) => row.classId === classRow.id)) {
    result.push({
      classRow,
      date: dateOnly(session.date),
      slotId: session.scheduleSlotId,
      sessionId: session.id,
      start: session.startTime,
      end: session.endTime,
    });
  }
  return result;
}
/** Reconciles projected meetings with materialized sessions by their stable slot/date identity. */
export async function meetingsBetween(input: MeetingsBetweenInput): Promise<TeacherMeeting[]> {
  const range = { gte: utcDate(input.from), lte: utcDate(input.through) };
  const data = await loadScheduleData(input.database, range);
  const now = input.now ?? new Date();
  const context = projectionContext(data, now);
  const result = new Map<string, TeacherMeeting>();
  for (const classRow of data.classes) {
    for (const candidate of classCandidates(classRow, { range, sessions: data.sessions, now })) {
      const meeting = projectMeeting(candidate, context);
      if (meeting) result.set(meetingKey(meeting), meeting);
    }
  }
  return [...result.values()].toSorted((left, right) =>
    `${left.date}${left.startTime}${left.classCode}`.localeCompare(
      `${right.date}${right.startTime}${right.classCode}`,
    ),
  );
}
export async function teacherWeek(
  input: TeacherWeekInput,
): Promise<{
  rows: TeacherMeeting[];
  introductions: Awaited<ReturnType<typeof introductoryMeetings>>;
  minutes: number;
  week: string;
}> {
  const days = weekDates(input.week);
  const meetings = await meetingsBetween({
    database: input.database,
    from: days[0]!,
    through: days[LAST_WEEK_DAY]!,
    ...(input.now ? { now: input.now } : {}),
  });
  const rows = meetings.filter(
    (row) => row.usualTeacherId === input.teacherId || row.substituteTeacherId === input.teacherId,
  );
  const minutes = rows.reduce(
    (sum, row) => sum + (responsibleTeacherId(row) === input.teacherId ? row.minutes : 0),
    0,
  );
  const introductions = await introductoryMeetings(
    input.database,
    input.teacherId,
    days[0]!,
    days[LAST_WEEK_DAY]!,
  );
  const introductionMinutes = introductions.reduce(
    (sum, row) => sum + (row.status === "CANCELLED" ? 0 : teachingMinutes(row)),
    0,
  );
  return { rows, introductions, minutes: minutes + introductionMinutes, week: input.week };
}

type RecordedMeetingKeyInput = { classId: string; scheduleSlotId: string | null; date: Date };
type ClassCandidatesContext = {
  range: { gte: Date; lte: Date };
  sessions: ScheduleData["sessions"];
  now: Date;
};
type MeetingsBetweenInput = {
  database: Prisma.TransactionClient;
  from: string;
  through: string;
  now?: Date;
};
type TeacherWeekInput = {
  database: Prisma.TransactionClient;
  teacherId: string;
  week: string;
  now?: Date;
};
