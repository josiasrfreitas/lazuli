import { saoPauloDateOnly } from "@lazuli/domain";
import type { Context } from "../trpc/context.js";

/** Local home reporting rules. See docs/frontend/admin-home-kpi-debt.md before reuse. */
export function homePeriod(now: Date, requestedMonth?: string) {
  const today = saoPauloDateOnly(now);
  const month =
    requestedMonth && requestedMonth <= today.slice(0, 7) ? requestedMonth : today.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = month === today.slice(0, 7) ? Number(today.slice(8)) : lastDay;
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const previousLastDay = new Date(Date.UTC(year, monthNumber - 1, 0)).getUTCDate();
  const previousDay =
    month === today.slice(0, 7) ? Math.min(day, previousLastDay) : previousLastDay;
  const through = `${month}-${String(day).padStart(2, "0")}`;
  const previousThrough = `${previousMonth}-${String(previousDay).padStart(2, "0")}`;
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(Date.UTC(year, monthNumber - 6 + index, 1)).toISOString().slice(0, 7),
  );
  return {
    month,
    through,
    previousMonth,
    previousThrough,
    months,
    partial: month === today.slice(0, 7),
  };
}
export type HomePeriod = ReturnType<typeof homePeriod>;
export function monthlyCounts(dates: string[], period: HomePeriod) {
  const counts = new Map(period.months.map((month) => [month, 0]));
  let previous = 0;
  for (const date of dates) {
    const month = date.slice(0, 7);
    if (date <= period.through) counts.set(month, (counts.get(month) ?? 0) + 1);
    if (month === period.previousMonth && date <= period.previousThrough) previous++;
  }
  return {
    value: counts.get(period.month) ?? 0,
    previous,
    series: period.months.map((month) => ({ month, value: counts.get(month) ?? 0 })),
  };
}
export async function readHomeSchool(database: Context["db"], now: Date, requestedMonth?: string) {
  const period = homePeriod(now, requestedMonth);
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
      where: { deletedAt: null, status: "ATTENDED", kind: "TRIAL", date: dateRange },
      select: { date: true },
    }),
    database.student.count({ where: { deletedAt: null } }),
  ]);
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
      enrollments.map((row) => row.entryDate.toISOString().slice(0, 10)),
      period,
    ),
    trials: monthlyCounts(
      visits.map((row) => row.date.toISOString().slice(0, 10)),
      period,
    ),
  };
}
export async function readBusinessComparison(database: Context["db"], period: HomePeriod) {
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
        agreedOn: { gte: new Date(`${period.months[0]}-01`), lte: new Date(period.through) },
      },
      select: { agreedOn: true, renewedFromId: true },
    }),
  ]);
  const received = period.months.map((month) => ({ month, value: 0 }));
  let previousReceivedCents = 0;
  for (const payment of payments) {
    const date = payment.date.toISOString().slice(0, 10);
    const row = received.find((item) => item.month === date.slice(0, 7));
    if (row) row.value += payment.amountCents;
    if (date.slice(0, 7) === period.previousMonth && date <= period.previousThrough)
      previousReceivedCents += payment.amountCents;
  }
  return {
    received,
    previousReceivedCents,
    agreements: monthlyCounts(
      contracts.map((row) => row.agreedOn.toISOString().slice(0, 10)),
      period,
    ),
    newContracts: contracts.filter(
      (row) => row.agreedOn.toISOString().startsWith(period.month) && !row.renewedFromId,
    ).length,
    renewals: contracts.filter(
      (row) => row.agreedOn.toISOString().startsWith(period.month) && row.renewedFromId,
    ).length,
  };
}
