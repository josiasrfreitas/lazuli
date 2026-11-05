import { materialFinalPriceVersion, materialPriceVersion } from "./material-price-version.js";
import type { FinanceSettingsInput } from "@lazuli/validators";
import { tuitionFloorCents } from "@lazuli/validators";

import { materialPriceQuote } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import type { FinanceDatabase } from "./shared.js";

export type FinanceSettingsView = {
  tuitionCeilingCents: number | null;
  maximumDiscountPct: number | null;
  punctualityDiscountPct: number;
  tuitionFloorCents: number | null;
  interestRatePctMonthly: number | null;
  cancellationFeePct: number | null;
  materialPriceCents: number | null;
  childMaterialCashPriceCents: number;
  adultMaterialCashPriceCents: number;
  childMaterialInstallments: number;
  childMaterialInstallmentCents: number;
  adultMaterialInstallments: number;
  adultMaterialInstallmentCents: number;
  materialCardFeePct: number;
  materialCardFeeRates: Record<string, number>;
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
    interestRatePctMonthly:
      row.interestRatePctMonthly === null ? null : Number(row.interestRatePctMonthly),
    cancellationFeePct: row.cancellationFeePct === null ? null : Number(row.cancellationFeePct),
    materialPriceCents: row.materialPriceCents,
    childMaterialCashPriceCents: materialCashPrice({
      cashCents: row.childMaterialCashPriceCents,
      installments: row.childMaterialInstallments,
      installmentCents: row.childMaterialInstallmentCents,
      cardFeePct: Number(row.materialCardFeePct),
    }),
    adultMaterialCashPriceCents: materialCashPrice({
      cashCents: row.adultMaterialCashPriceCents,
      installments: row.adultMaterialInstallments,
      installmentCents: row.adultMaterialInstallmentCents,
      cardFeePct: Number(row.materialCardFeePct),
    }),
    childMaterialInstallments: row.childMaterialInstallments,
    childMaterialInstallmentCents: row.childMaterialInstallmentCents,
    adultMaterialInstallments: row.adultMaterialInstallments,
    adultMaterialInstallmentCents: row.adultMaterialInstallmentCents,
    materialCardFeePct: Number(row.materialCardFeePct),
    materialCardFeeRates: readMaterialCardFeeRates(
      row.materialCardFeeRates,
      Number(row.materialCardFeePct),
    ),
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
export async function readMaterialPrice(database: FinanceDatabase): Promise<{
  child: { cashCents: number; version: string };
  adult: { cashCents: number; version: string };
  cardFeeRates: Record<string, number>;
} | null> {
  const row = await database.financeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      childMaterialInstallments: true,
      childMaterialInstallmentCents: true,
      childMaterialCashPriceCents: true,
      adultMaterialInstallments: true,
      adultMaterialInstallmentCents: true,
      adultMaterialCashPriceCents: true,
      materialCardFeePct: true,
      materialCardFeeRates: true,
    },
  });
  if (!row) return null;
  const cardFeePct = Number(row.materialCardFeePct);
  const cardFeeRates = readMaterialCardFeeRates(row.materialCardFeeRates, cardFeePct);
  return {
    child: materialPriceBand({
      storedCashCents: row.childMaterialCashPriceCents,
      installments: row.childMaterialInstallments,
      installmentCents: row.childMaterialInstallmentCents,
      legacyFeePct: cardFeePct,
      cardFeeRates,
      legacyRates: row.materialCardFeeRates === null,
    }),
    adult: materialPriceBand({
      storedCashCents: row.adultMaterialCashPriceCents,
      installments: row.adultMaterialInstallments,
      installmentCents: row.adultMaterialInstallmentCents,
      legacyFeePct: cardFeePct,
      cardFeeRates,
      legacyRates: row.materialCardFeeRates === null,
    }),
    cardFeeRates,
  };
}

function materialCashPrice({
  cashCents,
  installments,
  installmentCents,
  cardFeePct,
}: {
  cashCents: number | null;
  installments: number;
  installmentCents: number;
  cardFeePct: number;
}): number {
  return cashCents ?? materialPriceQuote({ installments, installmentCents, cardFeePct }).cashCents;
}

function materialPriceBand({
  storedCashCents,
  installments,
  installmentCents,
  legacyFeePct,
  cardFeeRates,
  legacyRates,
}: {
  storedCashCents: number | null;
  installments: number;
  installmentCents: number;
  legacyFeePct: number;
  cardFeeRates: Record<string, number>;
  legacyRates: boolean;
}): { cashCents: number; version: string } {
  const cashCents = materialCashPrice({
    cashCents: storedCashCents,
    installments,
    installmentCents,
    cardFeePct: legacyFeePct,
  });
  const version =
    storedCashCents === null && legacyRates
      ? materialPriceVersion(installments, { installmentCents, cardFeePct: legacyFeePct })
      : materialFinalPriceVersion(cashCents, cardFeeRates);
  return { cashCents, version };
}

export function readMaterialCardFeeRates(
  value: Prisma.JsonValue | null,
  fallbackPct: number,
): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rates: Array<[string, number]> = [];
    for (const [count, rate] of Object.entries(value))
      if (/^[1-9]\d*$/u.test(count) && typeof rate === "number") rates.push([count, rate]);
    return Object.fromEntries(rates);
  }
  return Object.fromEntries(
    Array.from({ length: 12 }, (_value, index) => [String(index + 1), fallbackPct]),
  );
}
