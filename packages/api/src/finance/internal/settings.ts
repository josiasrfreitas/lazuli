import type { FinanceSettingsInput } from "@lazuli/validators";
import { tuitionFloorCents } from "@lazuli/validators";

import type { FinanceDatabase } from "./shared.js";

export type FinanceSettingsView = {
  tuitionCeilingCents: number | null;
  maximumDiscountPct: number | null;
  punctualityDiscountPct: number;
  tuitionFloorCents: number | null;
  interestRatePctDaily: number | null;
  interestRatePctMonthly: number | null;
  cancellationFeePct: number | null;
  materialPriceCents: number | null;
  updatedAt: Date;
  updatedByName: string | null;
};

export async function readSettings(database: FinanceDatabase): Promise<FinanceSettingsView | null> {
  const row = await database.financeSettings.findUnique({
    where: { id: "singleton" },
    include: { updatedBy: { select: { name: true } } },
  });
  if (row === null) return null;
  return {
    tuitionCeilingCents: row.tuitionCeilingCents,
    maximumDiscountPct: row.maximumDiscountPct === null ? null : Number(row.maximumDiscountPct),
    punctualityDiscountPct: Number(row.punctualityDiscountPct),
    tuitionFloorCents:
      row.tuitionCeilingCents === null || row.maximumDiscountPct === null
        ? null
        : tuitionFloorCents(row.tuitionCeilingCents, Number(row.maximumDiscountPct)),
    interestRatePctDaily:
      row.interestRatePctDaily === null ? null : Number(row.interestRatePctDaily),
    interestRatePctMonthly:
      row.interestRatePctMonthly === null ? null : Number(row.interestRatePctMonthly),
    cancellationFeePct: row.cancellationFeePct === null ? null : Number(row.cancellationFeePct),
    materialPriceCents: row.materialPriceCents,
    updatedAt: row.updatedAt,
    updatedByName: row.updatedBy?.name ?? null,
  };
}

export async function saveSettings(input: {
  database: FinanceDatabase;
  staffUserId: string;
  values: FinanceSettingsInput;
}): Promise<FinanceSettingsView | null> {
  const { database, staffUserId, values } = input;
  const { punctualityDiscountPct, ...otherValues } = values;
  const data = {
    ...otherValues,
    ...(punctualityDiscountPct === undefined ? {} : { punctualityDiscountPct }),
  };
  await database.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedById: staffUserId },
    update: { ...data, updatedById: staffUserId },
  });
  return readSettings(database);
}
