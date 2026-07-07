/**
 * Worker-only handlers for Portal (Playwright), PDFs, GCS, Resend (§2.1).
 * NEVER imported by `apps/web` or `@lazuli/api` — only `apps/worker` consumes this.
 */

import type { Prisma } from "@lazuli/db";
import { resolveSemesterForDate, type SemesterWindow } from "@lazuli/domain";
import { sessionsGeneratePayloadSchema, type SessionsGeneratePayload } from "@lazuli/job-contracts";

export const WORKER_HANDLERS_PACKAGE = "@lazuli/worker-handlers" as const;

const DATE_ONLY_LENGTH = 10;
const MILLISECONDS_PER_DAY = 86_400_000;

type SessionGenerationDatabase = Pick<
  Prisma.TransactionClient,
  "class" | "semester" | "schoolClosedDay" | "classSession"
>;

type SessionGenerationClass = {
  id: string;
  semester: SemesterWindow;
  scheduleSlots: SessionGenerationSlot[];
};

type SessionGenerationSlot = {
  id: string;
  weekday: WeekdayName;
  startTime: Date;
  endTime: Date;
};

type SessionRow = {
  classId: string;
  scheduleSlotId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
};

type WeekdayName =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type SessionGenerationResult = {
  classesMatched: number;
  sessionsCreated: number;
  sessionsPlanned: number;
};

export async function generateClassSessions(input: {
  database: SessionGenerationDatabase;
  payload: SessionsGeneratePayload;
}): Promise<SessionGenerationResult> {
  const payload = sessionsGeneratePayloadSchema.parse(input.payload);
  const classes = await loadSessionGenerationClasses({ database: input.database, payload });
  const semesters = await loadSemesterWindows(input.database);
  const closedDates = await loadClosedDates({ database: input.database, classes });
  const rows = planClassSessionRows({ classes, closedDates, semesters });

  if (rows.length === 0) {
    return { classesMatched: classes.length, sessionsCreated: 0, sessionsPlanned: 0 };
  }

  const result = await input.database.classSession.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    classesMatched: classes.length,
    sessionsCreated: result.count,
    sessionsPlanned: rows.length,
  };
}

export function planClassSessionRows(input: {
  classes: readonly SessionGenerationClass[];
  closedDates: ReadonlySet<string>;
  semesters: readonly SemesterWindow[];
}): SessionRow[] {
  return input.classes.flatMap((classRow) =>
    planRowsForClass({
      classRow,
      closedDates: input.closedDates,
      semesters: input.semesters,
    }),
  );
}

async function loadSessionGenerationClasses(input: {
  database: SessionGenerationDatabase;
  payload: SessionsGeneratePayload;
}): Promise<SessionGenerationClass[]> {
  const rows = await input.database.class.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...scopeWhere(input.payload),
    },
    select: {
      id: true,
      semester: { select: { id: true, name: true, startDate: true, endDate: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { id: true, weekday: true, startTime: true, endTime: true },
      },
    },
  });

  return rows;
}

function scopeWhere(payload: SessionsGeneratePayload): { id?: string; semesterId?: string } {
  if (payload.classId !== undefined) {
    return { id: payload.classId };
  }

  if (payload.semesterId !== undefined) {
    return { semesterId: payload.semesterId };
  }

  return {};
}

async function loadSemesterWindows(database: SessionGenerationDatabase): Promise<SemesterWindow[]> {
  return database.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

async function loadClosedDates(input: {
  database: SessionGenerationDatabase;
  classes: readonly SessionGenerationClass[];
}): Promise<ReadonlySet<string>> {
  const window = generationWindow(input.classes);

  if (window === null) {
    return new Set();
  }

  const rows = await input.database.schoolClosedDay.findMany({
    where: {
      deletedAt: null,
      date: { gte: window.startDate, lte: window.endDate },
    },
    select: { date: true },
  });

  return new Set(rows.map((row) => dateToDateOnly(row.date)));
}

function generationWindow(classes: readonly SessionGenerationClass[]): {
  startDate: Date;
  endDate: Date;
} | null {
  const [firstClass] = classes;

  if (firstClass === undefined) {
    return null;
  }

  let startDate = firstClass.semester.startDate;
  let endDate = firstClass.semester.endDate;

  for (const classRow of classes) {
    startDate = new Date(Math.min(startDate.getTime(), classRow.semester.startDate.getTime()));
    endDate = new Date(Math.max(endDate.getTime(), classRow.semester.endDate.getTime()));
  }

  return { startDate, endDate };
}

function planRowsForClass(input: {
  classRow: SessionGenerationClass;
  closedDates: ReadonlySet<string>;
  semesters: readonly SemesterWindow[];
}): SessionRow[] {
  const rows: SessionRow[] = [];

  for (const date of dateRange(
    input.classRow.semester.startDate,
    input.classRow.semester.endDate,
  )) {
    resolveSemesterForDate(date, input.semesters);

    if (!input.closedDates.has(dateToDateOnly(date))) {
      rows.push(...rowsForDate({ classRow: input.classRow, date }));
    }
  }

  return rows;
}

function rowsForDate(input: { classRow: SessionGenerationClass; date: Date }): SessionRow[] {
  const weekday = weekdayForDate(input.date);
  const slots = input.classRow.scheduleSlots.filter((slot) => slot.weekday === weekday);

  return slots.map((slot) => ({
    classId: input.classRow.id,
    scheduleSlotId: slot.id,
    date: input.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
}

function dateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const endTime = dateOnlyUtc(endDate).getTime();

  for (
    let currentTime = dateOnlyUtc(startDate).getTime();
    currentTime <= endTime;
    currentTime += MILLISECONDS_PER_DAY
  ) {
    dates.push(new Date(currentTime));
  }

  return dates;
}

function dateOnlyUtc(value: Date): Date {
  return new Date(`${dateToDateOnly(value)}T00:00:00.000Z`);
}

function dateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, DATE_ONLY_LENGTH);
}

function weekdayForDate(date: Date): WeekdayName {
  const weekdays: readonly WeekdayName[] = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];

  return weekdays[date.getUTCDay()] ?? "SUNDAY";
}

export { processReportGenerate } from "./reports/process-report-generate.js";
export type { ProcessReportGenerateResult } from "./reports/process-report-generate.js";
export { sendOverdueD30 } from "./email/send-overdue-d30.js";
export type { SendOverdueD30Result } from "./email/send-overdue-d30.js";
export { sendOverdueDigest } from "./email/send-overdue-digest.js";
export { sendPortalFailureEmail } from "./email/send-portal-failure-email.js";
export type { SendPortalFailureEmailResult } from "./email/send-portal-failure-email.js";
