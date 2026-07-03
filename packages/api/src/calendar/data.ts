import type { Prisma } from "@lazuli/db";
import { brazilFederalHolidaysForYear } from "@lazuli/domain";

const TIMEZONE = "America/Sao_Paulo";
const DATE_ONLY_LENGTH = 10;

export type CalendarDatabase = Pick<Prisma.TransactionClient, "schoolClosedDay">;

export type ClosedDaySummary = {
  id: string;
  date: string;
  reason: string;
  createdById: string | null;
};

export type CalendarSessionWarning = {
  sessionId: string;
  reason: string;
};

export type ClosedDayWriteResult = {
  closedDay: ClosedDaySummary;
  created: boolean;
  updated: boolean;
  cancelledSessions: number;
  warnings: CalendarSessionWarning[];
  regenerateRequired: boolean;
};

const closedDaySelect = {
  id: true,
  date: true,
  reason: true,
  createdById: true,
} as const;

export async function importBrazilFederalHolidays(input: {
  database: CalendarDatabase;
  year: number;
  createdById: string;
}): Promise<{
  year: number;
  imported: number;
  skipped: number;
  holidays: ClosedDaySummary[];
}> {
  const holidays = brazilFederalHolidaysForYear(input.year);

  const result = await input.database.schoolClosedDay.createMany({
    data: holidays.map((holiday) => ({
      date: dateOnlyToDate(holiday.date),
      reason: holiday.reason,
      createdById: input.createdById,
    })),
    skipDuplicates: true,
  });

  const rows = await input.database.schoolClosedDay.findMany({
    where: { date: { in: holidays.map((holiday) => dateOnlyToDate(holiday.date)) } },
    orderBy: { date: "asc" },
    select: closedDaySelect,
  });

  return {
    year: input.year,
    imported: result.count,
    skipped: holidays.length - result.count,
    holidays: rows.map((row) => toClosedDaySummary(row)),
  };
}

export async function addClosedDay(input: {
  database: CalendarDatabase;
  date: string;
  reason: string;
  createdById: string;
}): Promise<ClosedDayWriteResult> {
  const date = dateOnlyToDate(input.date);
  const existing = await input.database.schoolClosedDay.findUnique({
    where: { date },
    select: closedDaySelect,
  });

  const closedDay =
    existing === null
      ? await input.database.schoolClosedDay.create({
          data: { date, reason: input.reason, createdById: input.createdById },
          select: closedDaySelect,
        })
      : await input.database.schoolClosedDay.update({
          where: { date },
          data: { reason: input.reason },
          select: closedDaySelect,
        });

  const cancellation = cancelFutureSessionsForClosedDate(input.date);

  return {
    closedDay: toClosedDaySummary(closedDay),
    created: existing === null,
    updated: existing !== null,
    cancelledSessions: cancellation.cancelledSessions,
    warnings: cancellation.warnings,
    regenerateRequired: false,
  };
}

export async function removeClosedDay(input: {
  database: CalendarDatabase;
  date: string;
}): Promise<{
  removed: boolean;
  regenerateRequired: boolean;
}> {
  const date = dateOnlyToDate(input.date);
  const existing = await input.database.schoolClosedDay.findUnique({
    where: { date },
    select: { id: true },
  });

  if (existing === null) {
    return { removed: false, regenerateRequired: isFutureDate(input.date) };
  }

  await input.database.schoolClosedDay.delete({ where: { date } });
  return { removed: true, regenerateRequired: isFutureDate(input.date) };
}

function toClosedDaySummary(row: {
  id: string;
  date: Date;
  reason: string;
  createdById: string | null;
}): ClosedDaySummary {
  return {
    id: row.id,
    date: dateToDateOnly(row.date),
    reason: row.reason,
    createdById: row.createdById,
  };
}

function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, DATE_ONLY_LENGTH);
}

function cancelFutureSessionsForClosedDate(date: string): {
  cancelledSessions: number;
  warnings: CalendarSessionWarning[];
} {
  if (!isFutureDate(date)) {
    return { cancelledSessions: 0, warnings: [] };
  }

  // GRE-27 owns ClassSession generation/regeneration. Once that table exists, this
  // function is the narrow place to cancel eligible future sessions for a closed day.
  return { cancelledSessions: 0, warnings: [] };
}

function isFutureDate(date: string): boolean {
  return date > todayInSaoPaulo();
}

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}
