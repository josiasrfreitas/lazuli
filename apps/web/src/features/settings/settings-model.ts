import type { RouterOutputs } from "@lazuli/api";
import {
  financeSettingsInputSchema,
  tuitionFloorCents,
  type FinanceSettingsInput,
} from "@lazuli/validators";

import { INITIAL_MATERIAL_PRICING, materialFinalPriceQuote } from "@lazuli/domain";

const CENTS_PER_REAL = 100;
const MAX_PERCENT = 100;
const MONEY_DECIMAL_PLACES = 2;
const PERCENT_DECIMAL_PLACES = 4;
export type SettingsFields = Record<
  Exclude<
    keyof FinanceSettingsInput,
    | "materialPriceCents"
    | "childMaterialInstallments"
    | "childMaterialInstallmentCents"
    | "adultMaterialInstallments"
    | "adultMaterialInstallmentCents"
    | "materialCardFeePct"
  >,
  string
>;
export type SettingsErrors = Partial<SettingsFields>;
export type SettingsRow = NonNullable<RouterOutputs["finance"]["readSettings"]>;

export function displaySetting(name: keyof SettingsFields, text: string): string {
  if (text === "") return "—";
  const monetary = name.endsWith("Cents");
  const numeric = Number(text.replace(",", "."));
  const value = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: monetary && !Number.isInteger(numeric) ? MONEY_DECIMAL_PLACES : 0,
    maximumFractionDigits: monetary ? MONEY_DECIMAL_PLACES : PERCENT_DECIMAL_PLACES,
  }).format(numeric);
  if (monetary) return `R$${value}`;
  return `${value}%`;
}

function number(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function amount(value: number | null | undefined): string {
  return value === null || value === undefined
    ? ""
    : (value / CENTS_PER_REAL).toFixed(2).replace(".", ",");
}

export function loadedFields(row: SettingsRow | null): SettingsFields {
  return {
    ...loadedFinanceFields(row),
    ...loadedMaterialFields(row),
  };
}

function loadedFinanceFields(
  row: SettingsRow | null,
): Pick<
  SettingsFields,
  | "tuitionCeilingCents"
  | "maximumDiscountPct"
  | "punctualityDiscountPct"
  | "interestRatePctMonthly"
  | "cancellationFeePct"
> {
  return {
    tuitionCeilingCents: amount(row?.tuitionCeilingCents),
    maximumDiscountPct: number(row?.maximumDiscountPct),
    punctualityDiscountPct: number(row?.punctualityDiscountPct ?? 0),
    interestRatePctMonthly: number(row?.interestRatePctMonthly ?? 2),
    cancellationFeePct: number(row?.cancellationFeePct),
  };
}

function loadedMaterialFields(
  row: SettingsRow | null,
): Pick<
  SettingsFields,
  "childMaterialCashPriceCents" | "adultMaterialCashPriceCents" | "materialCardFeeRates"
> {
  return {
    childMaterialCashPriceCents: amount(
      row?.childMaterialCashPriceCents ?? INITIAL_MATERIAL_PRICING.childMaterialCashPriceCents,
    ),
    adultMaterialCashPriceCents: amount(
      row?.adultMaterialCashPriceCents ?? INITIAL_MATERIAL_PRICING.adultMaterialCashPriceCents,
    ),
    materialCardFeeRates: JSON.stringify(
      Object.fromEntries(
        Object.entries(
          row?.materialCardFeeRates ??
            Object.fromEntries(
              Array.from({ length: 12 }, (_unused, index) => [
                String(index + 1),
                INITIAL_MATERIAL_PRICING.materialCardFeePct,
              ]),
            ),
        ).map(([count, rate]) => [count, String(rate)]),
      ),
    ),
  };
}

function decimal(text: string): number {
  const trimmed = text.trim();
  return /^\d+(?:[.,]\d+)?$/u.test(trimmed) ? Number(trimmed.replace(",", ".")) : Number.NaN;
}

function fieldError(name: keyof SettingsFields, text: string): string | undefined {
  if (text.trim() === "") return "Informe um valor.";
  if (name === "materialCardFeeRates") return cardFeeRatesError(text);
  const value = decimal(text);
  if (!Number.isFinite(value)) return "Use um número, como 10 ou 0,5.";
  if (!name.endsWith("Cents")) return percentError(text, value);
  return amountError({ name, text, value });
}

function cardFeeRatesError(text: string): string | undefined {
  try {
    const rates = JSON.parse(text) as Record<string, string>;
    if (!rates || typeof rates !== "object" || Object.keys(rates).length === 0)
      return "Configure pelo menos uma taxa do cartão.";
    for (const [count, rate] of Object.entries(rates))
      if (
        !/^[1-9]\d*$/u.test(count) ||
        percentError(rate, decimal(rate)) ||
        decimal(rate) >= MAX_PERCENT
      )
        return "Confira as taxas por quantidade de parcelas.";
    return undefined;
  } catch {
    return "Confira as taxas por quantidade de parcelas.";
  }
}

function percentError(text: string, value: number): string | undefined {
  if (value > MAX_PERCENT) return "Use um percentual entre 0 e 100.";
  if (!/^\d+(?:[.,]\d{1,4})?$/u.test(text.trim())) return "Use no máximo quatro casas decimais.";
  return undefined;
}

function amountError({
  name,
  text,
  value,
}: {
  name: keyof SettingsFields;
  text: string;
  value: number;
}): string | undefined {
  if (!/^\d+(?:[.,]\d{1,2})?$/u.test(text.trim())) return "Use no máximo duas casas decimais.";
  if (name === "tuitionCeilingCents" && value === 0)
    return "A mensalidade deve ser maior que zero.";
  return undefined;
}

export function validateSettings(
  fields: SettingsFields,
): { success: true; values: FinanceSettingsInput } | { success: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  for (const name of Object.keys(fields) as (keyof SettingsFields)[]) {
    const error = fieldError(name, fields[name]);
    if (error !== undefined) errors[name] = error;
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };
  const result = financeSettingsInputSchema.safeParse({
    tuitionCeilingCents: Math.round(decimal(fields.tuitionCeilingCents) * CENTS_PER_REAL),
    maximumDiscountPct: decimal(fields.maximumDiscountPct),
    punctualityDiscountPct: decimal(fields.punctualityDiscountPct),
    interestRatePctMonthly: decimal(fields.interestRatePctMonthly),
    cancellationFeePct: decimal(fields.cancellationFeePct),
    childMaterialCashPriceCents: Math.round(
      decimal(fields.childMaterialCashPriceCents) * CENTS_PER_REAL,
    ),
    adultMaterialCashPriceCents: Math.round(
      decimal(fields.adultMaterialCashPriceCents) * CENTS_PER_REAL,
    ),
    materialCardFeeRates: Object.fromEntries(
      Object.entries(JSON.parse(fields.materialCardFeeRates) as Record<string, string>).map(
        ([count, rate]) => [count, decimal(rate)],
      ),
    ),
  });
  if (result.success) return { success: true, values: result.data };
  for (const issue of result.error.issues) {
    errors[issue.path[0] as keyof SettingsFields] = "Confira o valor informado.";
  }
  return { success: false, errors };
}

export function floorLabel(fields: SettingsFields): string {
  const ceiling = decimal(fields.tuitionCeilingCents);
  const discount = decimal(fields.maximumDiscountPct);
  if (
    fieldError("tuitionCeilingCents", fields.tuitionCeilingCents) !== undefined ||
    fieldError("maximumDiscountPct", fields.maximumDiscountPct) !== undefined
  )
    return "—";
  return displaySetting(
    "tuitionCeilingCents",
    String(tuitionFloorCents(Math.round(ceiling * CENTS_PER_REAL), discount) / CENTS_PER_REAL),
  );
}

export function bookQuote(
  fields: SettingsFields,
  { category, installments = 1 }: { category: "child" | "adult"; installments?: number },
): ReturnType<typeof materialFinalPriceQuote> | null {
  const amountKey =
    category === "child" ? "childMaterialCashPriceCents" : "adultMaterialCashPriceCents";
  try {
    const rates = JSON.parse(fields.materialCardFeeRates) as Record<string, string>;
    const rate = rates[String(installments)];
    if (
      rate === undefined ||
      fieldError(amountKey, fields[amountKey]) ||
      fieldError("materialCardFeeRates", fields.materialCardFeeRates)
    )
      return null;
    return materialFinalPriceQuote({
      cashCents: Math.round(decimal(fields[amountKey]) * CENTS_PER_REAL),
      cardFeePct: decimal(rate),
    });
  } catch {
    return null;
  }
}
