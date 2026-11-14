import type { Prisma } from "@lazuli/db";
import { TRPCError } from "@trpc/server";
import type { Period, AcademicInterruption } from "@lazuli/db/prisma";
import type { CalendarChange } from "./change-schema.js";
import { civil, day } from "./change-dates.js";
type PeriodChange = Extract<CalendarChange, { action: "period" }>;
export function validateCalendarVersion(
  change: CalendarChange,
  input: { period: Period | undefined; interruption: AcademicInterruption | undefined },
): void {
  const { period, interruption } = input;
  if ("id" in change && change.id) {
    const original = change.action === "period" ? period : interruption;
    if (!original || original.updatedAt.toISOString() !== change.expectedUpdatedAt)
      throw new TRPCError({
        code: "CONFLICT",
        message: "O calendário mudou. Reabra o formulário antes de continuar.",
      });
  }
}
export async function validateCalendarPeriod(
  database: Prisma.TransactionClient,
  input: { change: PeriodChange; periods: Period[]; period: Period | undefined },
): Promise<void> {
  const { change, periods, period } = input;
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
  if (period) await validatePeriodPlacements(database, { periodId: period.id, change });
}
async function validatePeriodPlacements(
  database: Prisma.TransactionClient,
  input: { periodId: string; change: PeriodChange },
): Promise<void> {
  const { periodId, change } = input;
  const [placements, lateClasses] = await Promise.all([
    database.semesterPlacement.count({
      where: {
        semesterId: periodId,
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
        semesterId: periodId,
        deletedAt: null,
        startDate: { not: null },
        OR: [{ startDate: { lt: day(change.from) } }, { startDate: { gt: day(change.through) } }],
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
