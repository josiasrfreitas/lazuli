import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";
import type { CalendarChange } from "./change-schema.js";

export const civil = (date: Date) => date.toISOString().slice(0, 10);
export const day = (date: string) => new Date(`${date}T00:00:00Z`);
export function datesBetween(from: string, through: string): string[] {
  const dates: string[] = [];
  for (let current = Date.parse(from); current <= Date.parse(through); current += 86400000)
    dates.push(civil(new Date(current)));
  return dates;
}
export async function calendarChangeState(
  database: Prisma.TransactionClient,
  change: CalendarChange,
) {
  const [periods, interruptions, closedDays] = await Promise.all([
    database.period.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    database.academicInterruption.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    database.schoolClosedDay.findMany({ where: { deletedAt: null }, orderBy: { date: "asc" } }),
  ]);
  const period =
    change.action === "period" && change.id
      ? periods.find((item) => item.id === change.id)
      : undefined;
  const interruption =
    (change.action === "interruption" || change.action === "removeInterruption") && change.id
      ? interruptions.find((item) => item.id === change.id)
      : undefined;
  if ("id" in change && change.id) {
    const original = change.action === "period" ? period : interruption;
    if (!original || original.updatedAt.toISOString() !== change.expectedUpdatedAt)
      throw new TRPCError({
        code: "CONFLICT",
        message: "O calendário mudou. Reabra o formulário antes de continuar.",
      });
  }
  if (change.action === "period") {
    if (periods.some((item) => item.id !== change.id && item.name === change.name))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Já existe um semestre com este nome. Escolha outro nome.",
      });
    const overlap = periods.find(
      (item) =>
        item.id !== change.id &&
        civil(item.startDate) <= change.through &&
        civil(item.endDate) >= change.from,
    );
    if (overlap)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `O intervalo coincide com ${overlap.name}. Ajuste as datas.`,
      });
    if (period) {
      const [placements, lateClasses] = await Promise.all([
        database.semesterPlacement.count({
          where: {
            semesterId: period.id,
            deletedAt: null,
            declinedAt: null,
            publishedAt: { not: null },
            OR: [
              { effectiveDate: { lt: day(change.from) } },
              { effectiveDate: { gt: day(change.through) } },
            ],
          },
        }),
        database.class.count({
          where: {
            semesterId: period.id,
            deletedAt: null,
            startDate: { not: null },
            OR: [
              { startDate: { lt: day(change.from) } },
              { startDate: { gt: day(change.through) } },
            ],
          },
        }),
      ]);
      if (placements)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${placements} alocações confirmadas ficariam fora do semestre. Revise as vigências antes de alterar as datas.`,
        });
      if (lateClasses)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${lateClasses} turmas têm início específico fora das novas datas. Revise o início dessas turmas antes de alterar o semestre.`,
        });
    }
  }
  const proposedPeriods =
    change.action === "period"
      ? [
          ...periods.filter((item) => item.id !== change.id),
          {
            id: change.id ?? "new",
            name: change.name,
            startDate: day(change.from),
            endDate: day(change.through),
          },
        ]
      : periods;
  const proposedInterruptions = interruptions.filter(
    (item) =>
      !(
        (change.action === "interruption" || change.action === "removeInterruption") &&
        item.id === change.id
      ),
  );
  const additions =
    change.action === "interruption"
      ? [{ fromDate: day(change.from), throughDate: day(change.through), title: change.title }]
      : change.action === "holidays"
        ? change.dates
            .filter(
              (item) => !interruptions.some((existing) => existing.sourceKey === item.sourceKey),
            )
            .map((item) => ({
              fromDate: day(item.date),
              throughDate: day(item.date),
              title: item.title,
            }))
        : [];
  const closed = new Set(
    closedDays.filter((item) => !item.calendarManaged).map((item) => civil(item.date)),
  );
  for (const item of [...proposedInterruptions, ...additions])
    for (const date of datesBetween(civil(item.fromDate), civil(item.throughDate)))
      closed.add(date);
  const range =
    change.action === "removeInterruption"
      ? [civil(interruption!.fromDate), civil(interruption!.throughDate)]
      : change.action === "holidays"
        ? change.dates.map((item) => item.date)
        : [
            change.from,
            change.through,
            ...(period ? [civil(period.startDate), civil(period.endDate)] : []),
            ...(interruption
              ? [civil(interruption.fromDate), civil(interruption.throughDate)]
              : []),
          ];
  range.sort();
  return {
    periods,
    interruptions,
    closedDays,
    period,
    interruption,
    proposedPeriods,
    closed,
    from: range[0]!,
    through: range.at(-1)!,
  };
}
export type CalendarChangeState = Awaited<ReturnType<typeof calendarChangeState>>;
