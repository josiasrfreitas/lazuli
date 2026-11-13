import type { Prisma } from "@lazuli/db";

/** Academic activity policy, independent from administrative opening hours. */
export async function academicDayPolicy(database: Prisma.TransactionClient, date: string) {
  const civilDate = new Date(`${date}T00:00:00Z`);
  const [period, suspension] = await Promise.all([
    database.period.findFirst({
      where: { deletedAt: null, startDate: { lte: civilDate }, endDate: { gte: civilDate } },
      select: { id: true, name: true },
    }),
    database.schoolClosedDay.findFirst({
      where: { deletedAt: null, date: civilDate },
      select: { reason: true },
    }),
  ]);
  return { date, outsidePeriod: !period, period, suspension: suspension?.reason ?? null };
}
