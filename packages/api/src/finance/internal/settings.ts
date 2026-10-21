import { materialPriceVersion } from "./material-price-version.js";
import type { FinanceSettingsInput } from "@lazuli/validators";
import { tuitionFloorCents } from "@lazuli/validators";

import { materialPriceQuote } from "@lazuli/domain";
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
  childMaterialInstallments: number;
  childMaterialInstallmentCents: number;
  adultMaterialInstallments: number;
  adultMaterialInstallmentCents: number;
  materialCardFeePct: number;
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
    childMaterialInstallments: row.childMaterialInstallments,
    childMaterialInstallmentCents: row.childMaterialInstallmentCents,
    adultMaterialInstallments: row.adultMaterialInstallments,
    adultMaterialInstallmentCents: row.adultMaterialInstallmentCents,
    materialCardFeePct: Number(row.materialCardFeePct),
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
  const data = Object.fromEntries(
    Object.entries({ ...otherValues, punctualityDiscountPct }).filter(
      ([, value]) => value !== undefined,
    ),
  ) as { [Key in keyof FinanceSettingsInput]: Exclude<FinanceSettingsInput[Key], undefined> };
  await database.financeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data, updatedById: staffUserId },
    update: { ...data, updatedById: staffUserId },
  });
  return readSettings(database);
}

/** Acquisition forms receive book pricing without exposing other financial settings. */
export async function readMaterialPrice(database: FinanceDatabase) {
  const row = await database.financeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      childMaterialInstallments: true,
      childMaterialInstallmentCents: true,
      adultMaterialInstallments: true,
      adultMaterialInstallmentCents: true,
      materialCardFeePct: true,
    },
  });
  if (!row) return null;
  const cardFeePct = Number(row.materialCardFeePct);
  return {
    child: {
      ...materialPriceQuote({
        installments: row.childMaterialInstallments,
        installmentCents: row.childMaterialInstallmentCents,
        cardFeePct,
      }),
      version: materialPriceVersion(
        row.childMaterialInstallments,
        row.childMaterialInstallmentCents,
        cardFeePct,
      ),
    },
    adult: {
      ...materialPriceQuote({
        installments: row.adultMaterialInstallments,
        installmentCents: row.adultMaterialInstallmentCents,
        cardFeePct,
      }),
      version: materialPriceVersion(
        row.adultMaterialInstallments,
        row.adultMaterialInstallmentCents,
        cardFeePct,
      ),
    },
    cardFeePct,
  };
}
