import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context } from "../trpc/context.js";

const YEAR_MONTH_LENGTH = 7;
const DAY_START = 8;
const DATE_ONLY_LENGTH = 10;
const SERIES_MONTHS = 6;
const SCHOOL_SERIES_MONTHS = 8;
type MonthlyCounts = {
  value: number;
  previous: number;
  series: { month: string; value: number }[];
};
export type HomePeriod = {
  month: string;
  through: string;
  previousMonth: string;
  previousThrough: string;
  months: string[];
  partial: boolean;
};
type HomeSchool = {
  month: string;
  through: string;
  previousThrough: string;
  partial: boolean;
  totalStudents: number;
  students: MonthlyCounts;
  enrollments: MonthlyCounts;
  trials: MonthlyCounts;
};
type BusinessComparison = {
  received: { month: string; value: number }[];
  previousReceivedCents: number;
  agreements: MonthlyCounts;
  newContracts: number;
  renewals: number;
};
/** Local home reporting rules. See docs/frontend/admin-home-kpi-debt.md before reuse. */
export function homePeriod(
  now: Date,
  {
    requestedMonth,
    seriesMonths = SERIES_MONTHS,
  }: { requestedMonth?: string | undefined; seriesMonths?: number } = {},
): HomePeriod {
  const today = saoPauloDateOnly(now);
  const month =
    requestedMonth && requestedMonth <= today.slice(0, YEAR_MONTH_LENGTH)
      ? requestedMonth
      : today.slice(0, YEAR_MONTH_LENGTH);
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day =
    month === today.slice(0, YEAR_MONTH_LENGTH) ? Number(today.slice(DAY_START)) : lastDay;
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1))
    .toISOString()
    .slice(0, YEAR_MONTH_LENGTH);
  const previousLastDay = new Date(Date.UTC(year, monthNumber - 1, 0)).getUTCDate();
  const previousDay =
    month === today.slice(0, YEAR_MONTH_LENGTH) ? Math.min(day, previousLastDay) : previousLastDay;
  const through = `${month}-${String(day).padStart(2, "0")}`;
  const previousThrough = `${previousMonth}-${String(previousDay).padStart(2, "0")}`;
  const months = Array.from({ length: seriesMonths }, (_unused, index) =>
    new Date(Date.UTC(year, monthNumber - seriesMonths + index, 1))
      .toISOString()
      .slice(0, YEAR_MONTH_LENGTH),
  );
  return {
    month,
    through,
    previousMonth,
    previousThrough,
    months,
    partial: month === today.slice(0, YEAR_MONTH_LENGTH),
  };
}
export function monthlyCounts(dates: string[], period: HomePeriod): MonthlyCounts {
  const counts = new Map(period.months.map((month) => [month, 0]));
  let previous = 0;
  for (const date of dates) {
    const month = date.slice(0, YEAR_MONTH_LENGTH);
    if (date <= period.through) counts.set(month, (counts.get(month) ?? 0) + 1);
    if (month === period.previousMonth && date <= period.previousThrough) previous++;
  }
  return {
    value: counts.get(period.month) ?? 0,
    previous,
    series: period.months.map((month) => ({ month, value: counts.get(month) ?? 0 })),
  };
}
function dateOnly(date: Date): string {
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
}
type SchoolRows = {
  students: { createdAt: Date }[];
  enrollments: { entryDate: Date }[];
  visits: { date: Date }[];
  totalStudents: number;
};
async function readSchoolRows(database: Context["db"], period: HomePeriod): Promise<SchoolRows> {
  const from = new Date(`${period.months[0]}-01T00:00:00-03:00`);
  const through = new Date(`${period.through}T23:59:59.999-03:00`);
  const dateRange = { gte: new Date(`${period.months[0]}-01`), lte: new Date(period.through) };
  const [students, enrollments, visits, totalStudents] = await Promise.all([
    database.student.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lte: through } },
      select: { createdAt: true },
    }),
    database.enrollment.findMany({
      where: {
        deletedAt: null,
        student: { deletedAt: null },
        class: { deletedAt: null },
        entryDate: dateRange,
      },
      select: { entryDate: true },
    }),
    database.entryVisit.findMany({
      where: {
        deletedAt: null,
        status: "ATTENDED",
        kind: { in: ["TRIAL", "INTRODUCTION"] },
        date: dateRange,
      },
      select: { date: true },
    }),
    database.student.count({ where: { deletedAt: null } }),
  ]);
  return { students, enrollments, visits, totalStudents };
}
export async function readHomeSchool({
  database,
  now,
  requestedMonth,
}: {
  database: Context["db"];
  now: Date;
  requestedMonth?: string | undefined;
}): Promise<HomeSchool> {
  const period = homePeriod(now, { requestedMonth, seriesMonths: SCHOOL_SERIES_MONTHS });
  const { students, enrollments, visits, totalStudents } = await readSchoolRows(database, period);
  return {
    month: period.month,
    through: period.through,
    previousThrough: period.previousThrough,
    partial: period.partial,
    totalStudents,
    students: monthlyCounts(
      students.map((row) => saoPauloDateOnly(row.createdAt)),
      period,
    ),
    enrollments: monthlyCounts(
      enrollments.map((row) => dateOnly(row.entryDate)),
      period,
    ),
    trials: monthlyCounts(
      visits.map((row) => dateOnly(row.date)),
      period,
    ),
  };
}
export async function readBusinessComparison(
  database: Context["db"],
  { period, contractPeriod = period }: { period: HomePeriod; contractPeriod?: HomePeriod },
): Promise<BusinessComparison> {
  const [payments, contracts] = await Promise.all([
    database.paymentEntry.findMany({
      where: {
        deletedAt: null,
        date: { gte: new Date(`${period.months[0]}-01`), lte: new Date(period.through) },
      },
      select: { date: true, amountCents: true },
    }),
    database.contract.findMany({
      where: {
        deletedAt: null,
        agreedOn: {
          gte: new Date(`${contractPeriod.months[0]}-01`),
          lte: new Date(contractPeriod.through),
        },
      },
      select: { agreedOn: true, renewedFromId: true },
    }),
  ]);
  const received = period.months.map((month) => ({ month, value: 0 }));
  const datedContracts = contracts.filter(
    (row): row is typeof row & { agreedOn: Date } => row.agreedOn !== null,
  );
  let previousReceivedCents = 0;
  for (const payment of payments) {
    const date = payment.date.toISOString().slice(0, DATE_ONLY_LENGTH);
    const row = received.find((item) => item.month === date.slice(0, YEAR_MONTH_LENGTH));
    if (row) row.value += payment.amountCents;
    if (date.slice(0, YEAR_MONTH_LENGTH) === period.previousMonth && date <= period.previousThrough)
      previousReceivedCents += payment.amountCents;
  }
  return {
    received,
    previousReceivedCents,
    agreements: monthlyCounts(
      datedContracts.map((row) => row.agreedOn.toISOString().slice(0, DATE_ONLY_LENGTH)),
      contractPeriod,
    ),
    newContracts: datedContracts.filter(
      (row) => row.agreedOn.toISOString().startsWith(period.month) && !row.renewedFromId,
    ).length,
    renewals: datedContracts.filter(
      (row) => row.agreedOn.toISOString().startsWith(period.month) && row.renewedFromId,
    ).length,
  };
}
