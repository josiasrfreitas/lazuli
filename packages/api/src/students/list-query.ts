import type { Prisma } from "@lazuli/db";
import type { Weekday } from "@lazuli/domain";
import { saoPauloMidnightToInstant } from "@lazuli/domain";
import type { StudentListInput, StudentListStatusFilter } from "@lazuli/validators";

import type { Context } from "../trpc/context.js";

/**
 * Query shapes for `students.list`: the status/search filter, the page read
 * (student + most recent open enrollment), and the header/tab counters. Kept
 * apart from list.ts so the orchestration there stays readable.
 */

export type StudentListDatabase = Context["db"];

export type ScheduleSlot = { weekday: Weekday; startTime: Date };

const ACTIVE_STATUSES = ["ACTIVE"] as const;
const INACTIVE_STATUSES = ["INACTIVE", "SUSPENDED", "DROPPED"] as const;
const TAB_FILTERS = ["all", "active", "inactive"] as const;

/** Weekday order + pt-BR abbreviations for the schedule label. */
const WEEKDAYS: readonly (readonly [Weekday, string])[] = [
  ["MONDAY", "Seg"],
  ["TUESDAY", "Ter"],
  ["WEDNESDAY", "Qua"],
  ["THURSDAY", "Qui"],
  ["FRIDAY", "Sex"],
  ["SATURDAY", "Sáb"],
  ["SUNDAY", "Dom"],
];
const TIME_START_INDEX = 11;
const TIME_END_INDEX = 16;
const LABEL_SEPARATOR = " · ";
const LAST_WEEKDAY_SEPARATOR = " e ";
const DATE_ONLY_LENGTH = 10;

const openEnrollmentSelect = {
  id: true,
  classId: true,
  entryDate: true,
  exitDate: true,
  class: {
    select: {
      internalCode: true,
      teacher: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        select: { weekday: true, startTime: true },
      },
    },
  },
} satisfies Prisma.EnrollmentSelect;

const studentPageSelect = {
  id: true,
  fullName: true,
  status: true,
  phone: true,
  birthDate: true,
  enrollments: {
    where: { exitDate: null, deletedAt: null },
    orderBy: { entryDate: "desc" },
    take: 1,
    select: openEnrollmentSelect,
  },
} satisfies Prisma.StudentSelect;

export type StudentPageRow = Prisma.StudentGetPayload<{ select: typeof studentPageSelect }>;
export type OpenEnrollmentRow = StudentPageRow["enrollments"][number];

export function buildStudentListWhere(input: {
  status: StudentListStatusFilter;
  search?: string | undefined;
  situations?: StudentListInput["situations"];
  classIds?: string[] | undefined;
  teacherIds?: string[] | undefined;
  registeredFrom?: string | undefined;
  registeredTo?: string | undefined;
}): Prisma.StudentWhereInput {
  const situations = input.situations?.length
    ? input.situations.flatMap((situation) =>
        situation === "active" ? [...ACTIVE_STATUSES] : [...INACTIVE_STATUSES],
      )
    : undefined;
  return {
    deletedAt: null,
    AND: [
      situations ? { status: { in: situations } } : statusFilter(input.status),
      searchFilter(input.search),
      input.classIds?.length || input.teacherIds?.length
        ? {
            enrollments: {
              some: {
                deletedAt: null,
                exitDate: null,
                ...(input.classIds?.length ? { classId: { in: input.classIds } } : {}),
                ...(input.teacherIds?.length
                  ? { class: { teacherId: { in: input.teacherIds } } }
                  : {}),
              },
            },
          }
        : {},
      input.registeredFrom ? { createdAt: { gte: dayStart(input.registeredFrom) } } : {},
      input.registeredTo ? { createdAt: { lt: dayStart(nextDay(input.registeredTo)) } } : {},
    ],
  };
}

function dayStart(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return saoPauloMidnightToInstant({ year: year!, monthIndex: month! - 1, day: date! });
}

function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
}

/** The `students.preview` read: one student in the same shape as a page row. */
export function findStudentRow(input: {
  database: StudentListDatabase;
  id: string;
}): Promise<StudentPageRow | null> {
  return input.database.student.findFirst({
    where: { id: input.id, deletedAt: null },
    select: studentPageSelect,
  });
}

export function findStudentPage(input: {
  database: StudentListDatabase;
  values: { where: Prisma.StudentWhereInput; page: number; pageSize: StudentListInput["pageSize"] };
}): Promise<StudentPageRow[]> {
  return input.database.student.findMany({
    where: input.values.where,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    skip: (input.values.page - 1) * input.values.pageSize,
    take: input.values.pageSize,
    select: studentPageSelect,
  });
}

/** Tab counters share the current search so the tabs describe the same result set. */
export async function countStudentsByTab(input: {
  database: StudentListDatabase;
  search: string | undefined;
}): Promise<{ all: number; active: number; inactive: number }> {
  const [all, active, inactive] = await Promise.all(
    TAB_FILTERS.map((status) =>
      input.database.student.count({
        where: buildStudentListWhere({ status, search: input.search }),
      }),
    ),
  );

  return { all: all ?? 0, active: active ?? 0, inactive: inactive ?? 0 };
}

/** Header facts ("X alunos · Y turmas ativas"), independent of the current filters. */
export async function countHeaderFacts(input: {
  database: StudentListDatabase;
  semesterId: string | null;
}): Promise<{ totalStudents: number; activeClasses: number }> {
  const [totalStudents, activeClasses] = await Promise.all([
    input.database.student.count({ where: { deletedAt: null } }),
    countActiveClasses(input.database, input.semesterId),
  ]);

  return { totalStudents, activeClasses };
}

/**
 * e.g. "Seg e Qua · 19:00", "Sáb · 09:00". `slots` arrives ordered by weekday then
 * start time, so the first slot carries the time shown for the class.
 */
export function toScheduleLabel(slots: readonly ScheduleSlot[]): string {
  const [firstSlot] = slots;

  if (firstSlot === undefined) {
    return "";
  }

  const weekdays: string[] = [];
  for (const slot of slots) {
    const label = weekdayLabel(slot.weekday);
    if (!weekdays.includes(label)) {
      weekdays.push(label);
    }
  }

  return `${joinWeekdays(weekdays)}${LABEL_SEPARATOR}${toWallTime(firstSlot.startTime)}`;
}

function countActiveClasses(
  database: StudentListDatabase,
  semesterId: string | null,
): Promise<number> {
  if (semesterId === null) {
    return Promise.resolve(0);
  }

  return database.class.count({
    where: { deletedAt: null, status: "ACTIVE", semesterId },
  });
}

function weekdayLabel(weekday: Weekday): string {
  return WEEKDAYS.find(([value]) => value === weekday)?.[1] ?? "";
}

function joinWeekdays(weekdays: readonly string[]): string {
  if (weekdays.length <= 1) {
    return weekdays.join("");
  }

  return [weekdays.slice(0, -1).join(", "), weekdays.at(-1)].join(LAST_WEEKDAY_SEPARATOR);
}

/** `@db.Time` values come back as 1970-01-01T<HH:mm>:00Z; the wall time is what we show. */
function toWallTime(time: Date): string {
  return time.toISOString().slice(TIME_START_INDEX, TIME_END_INDEX);
}

function statusFilter(status: StudentListStatusFilter): Prisma.StudentWhereInput {
  if (status === "all") {
    return {};
  }

  return { status: { in: [...(status === "active" ? ACTIVE_STATUSES : INACTIVE_STATUSES)] } };
}

/** Matches the student name, or the code/teacher of any open enrollment. */
function searchFilter(search: string | undefined): Prisma.StudentWhereInput {
  if (search === undefined || search.length === 0) {
    return {};
  }

  const contains = { contains: search, mode: "insensitive" } as const;
  const openEnrollment = { deletedAt: null, exitDate: null };

  return {
    OR: [
      { fullName: contains },
      { enrollments: { some: { ...openEnrollment, class: { internalCode: contains } } } },
      { enrollments: { some: { ...openEnrollment, class: { teacher: { name: contains } } } } },
    ],
  };
}
