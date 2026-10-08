import type { Prisma } from "@lazuli/db";
import {
  responsibleTeacherId,
  saoPauloDateOnly,
  sessionEndInstant,
  teachingMinutes,
  weekdayOf,
  weekDates,
  type TeacherCommitment,
} from "@lazuli/domain";
import { dateToTimeString } from "../classes/time.js";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";

type Database = Prisma.TransactionClient;
const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);
const utcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
export type TeacherMeeting = TeacherCommitment & {
  sessionId: string | null;
  className: string;
  classCode: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  stageName: string | null;
  usualTeacherName: string | null;
  substituteTeacherName: string | null;
  minutes: number;
  editable: boolean;
};
export function meetingKey(row: {
  classId: string;
  slotId: string | null;
  sessionId?: string | null;
  date: string;
}): string {
  return `${row.classId}:${row.slotId ?? row.sessionId}:${row.date}`;
}
const classSelect = {
  ...responsibilitySelect,
  id: true,
  status: true,
  internalCode: true,
  portalClassName: true,
  scheduleType: true,
  format: true,
  sharedStage: { select: { name: true } },
  semester: { select: { startDate: true, endDate: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    select: { id: true, weekday: true, startTime: true, endTime: true },
  },
} satisfies Prisma.ClassSelect;

/** Reconciles projected meetings with materialized sessions by their stable slot/date identity. */
export async function meetingsBetween(input: {
  database: Database;
  from: string;
  through: string;
  now?: Date;
}): Promise<TeacherMeeting[]> {
  const range = { gte: utcDate(input.from), lte: utcDate(input.through) };
  const [classes, closedDays, sessions, substitutions] = await Promise.all([
    input.database.class.findMany({
      where: {
        deletedAt: null,
        OR: [
          { semester: { startDate: { lte: range.lte }, endDate: { gte: range.gte } } },
          { sessions: { some: { date: range } } },
        ],
      },
      select: classSelect,
    }),
    input.database.schoolClosedDay.findMany({
      where: { deletedAt: null, date: range },
      select: { date: true },
    }),
    input.database.classSession.findMany({
      where: { date: range },
      select: {
        responsibilityFrozenAt: true,
        usualTeacherId: true,
        usualTeacher: { select: { id: true, name: true } },
        id: true,
        classId: true,
        scheduleSlotId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        deletedAt: true,
        attendanceConfirmedAt: true,
        attendanceLastCommittedAt: true,
        _count: { select: { attendanceRows: true } },
      },
    }),
    input.database.classSubstitution.findMany({
      where: { date: range },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        revokedAt: true,
        coverageResolvedAt: true,
        classId: true,
        scheduleSlotId: true,
        classSessionId: true,
        date: true,
        teacherId: true,
        teacher: { select: { name: true, teacherProfile: { select: { departureDate: true } } } },
      },
    }),
  ]);
  const closed = new Set(closedDays.map((row) => dateOnly(row.date)));
  const keyFor = (
    row: { classId: string; scheduleSlotId: string | null; date: Date },
    sessionId: string | null,
  ) =>
    meetingKey({
      classId: row.classId,
      slotId: row.scheduleSlotId,
      sessionId,
      date: dateOnly(row.date),
    });
  const sessionByKey = new Map(sessions.map((row) => [keyFor(row, row.id), row]));
  const substituteByKey = new Map<string, (typeof substitutions)[number]>();
  // An active coverage always wins over an audit row, even when timestamps tie.
  for (const row of substitutions) {
    const key = keyFor(row, row.classSessionId);
    if (!substituteByKey.has(key) || !row.revokedAt || substituteByKey.get(key)?.revokedAt)
      substituteByKey.set(key, row);
  }
  const result = new Map<string, TeacherMeeting>();
  const now = input.now ?? new Date();
  function add(
    classRow: (typeof classes)[number],
    date: string,
    slotId: string | null,
    sessionId: string | null,
    start: Date,
    end: Date,
  ) {
    const key = meetingKey({ classId: classRow.id, slotId, sessionId, date });
    const session = sessionByKey.get(key);
    if (session?.status === "CANCELLED" || session?.deletedAt) return;
    const recorded = Boolean(
      session?.attendanceConfirmedAt ||
      session?.attendanceLastCommittedAt ||
      session?._count.attendanceRows,
    );
    if (closed.has(date) && !recorded) return;
    const usualTeacher = session?.responsibilityFrozenAt
      ? session.usualTeacher
      : usualTeacherOn(classRow, utcDate(date));
    const substitute = substituteByKey.get(key);
    const departure = substitute?.teacher.teacherProfile?.departureDate;
    const substituteTeacherId =
      substitute &&
      !substitute.revokedAt &&
      (!departure || utcDate(date) < departure || Boolean(session?.responsibilityFrozenAt))
        ? substitute.teacherId
        : null;
    const row: TeacherMeeting = {
      classId: classRow.id,
      slotId,
      sessionId: session?.id ?? sessionId,
      date,
      startTime: dateToTimeString(session?.startTime ?? start),
      endTime: dateToTimeString(session?.endTime ?? end),
      usualTeacherId: usualTeacher?.id ?? null,
      usualTeacherName: usualTeacher?.name ?? null,
      substituteTeacherId,
      substituteTeacherName: substituteTeacherId ? (substitute?.teacher.name ?? null) : null,
      requiresCoverage: Boolean(substitute?.revokedAt && !substitute.coverageResolvedAt),
      cancelled: false,
      className: classRow.portalClassName,
      classCode: classRow.internalCode,
      scheduleType: classRow.scheduleType,
      format: classRow.format,
      stageName: classRow.sharedStage?.name ?? null,
      minutes: 0,
      editable: false,
    };
    row.minutes = teachingMinutes(row);
    row.editable = !recorded && sessionEndInstant({ date, endTime: row.startTime }) > now;
    result.set(key, row);
  }
  for (const classRow of classes) {
    const start = Math.max(range.gte.getTime(), classRow.semester.startDate.getTime());
    const end = Math.min(range.lte.getTime(), classRow.semester.endDate.getTime());
    for (let day = start; day <= end; day += 86_400_000) {
      const date = dateOnly(new Date(day));
      if (classRow.status === "ARCHIVED" && date >= saoPauloDateOnly(now)) continue;
      for (const slot of classRow.scheduleSlots) {
        if (slot.weekday === weekdayOf(date))
          add(classRow, date, slot.id, null, slot.startTime, slot.endTime);
      }
    }
    for (const session of sessions.filter((row) => row.classId === classRow.id)) {
      add(
        classRow,
        dateOnly(session.date),
        session.scheduleSlotId,
        session.id,
        session.startTime,
        session.endTime,
      );
    }
  }
  return [...result.values()].sort((left, right) =>
    `${left.date}${left.startTime}${left.classCode}`.localeCompare(
      `${right.date}${right.startTime}${right.classCode}`,
    ),
  );
}
export async function teacherWeek(input: {
  database: Database;
  teacherId: string;
  week: string;
  now?: Date;
}) {
  const days = weekDates(input.week);
  const rows = (
    await meetingsBetween({
      database: input.database,
      from: days[0]!,
      through: days[6]!,
      ...(input.now ? { now: input.now } : {}),
    })
  ).filter(
    (row) => row.usualTeacherId === input.teacherId || row.substituteTeacherId === input.teacherId,
  );
  const minutes = rows.reduce(
    (sum, row) => sum + (responsibleTeacherId(row) === input.teacherId ? row.minutes : 0),
    0,
  );
  return { rows, minutes, week: input.week };
}
