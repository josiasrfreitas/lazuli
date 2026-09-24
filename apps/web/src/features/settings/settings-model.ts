import type { RouterOutputs } from "@lazuli/api";
import {
  financeSettingsInputSchema,
  tuitionFloorCents,
  type FinanceSettingsInput,
} from "@lazuli/validators";

const CENTS_PER_REAL = 100;
const MAX_PERCENT = 100;
const MONEY_DECIMAL_PLACES = 2;
const PERCENT_DECIMAL_PLACES = 4;
export type SettingsFields = Record<keyof FinanceSettingsInput, string>;
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
  return monetary ? `R$${value}` : `${value}%`;
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
    tuitionCeilingCents: amount(row?.tuitionCeilingCents),
    maximumDiscountPct: number(row?.maximumDiscountPct),
    interestRatePctDaily: number(row?.interestRatePctDaily),
    interestRatePctMonthly: number(row?.interestRatePctMonthly),
    cancellationFeePct: number(row?.cancellationFeePct),
    materialPriceCents: amount(row?.materialPriceCents),
  };
}

function decimal(text: string): number {
  const trimmed = text.trim();
  return /^\d+(?:[.,]\d+)?$/u.test(trimmed) ? Number(trimmed.replace(",", ".")) : Number.NaN;
}

function fieldError(name: keyof SettingsFields, text: string): string | undefined {
  if (text.trim() === "") return "Informe um valor.";
  const value = decimal(text);
  if (!Number.isFinite(value)) return "Use um número, como 10 ou 0,5.";
  if (!name.endsWith("Cents")) {
    if (value > MAX_PERCENT) return "Use um percentual entre 0 e 100.";
    if (!/^\d+(?:[.,]\d{1,4})?$/u.test(text.trim())) return "Use no máximo quatro casas decimais.";
    return undefined;
  }
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
    interestRatePctDaily: decimal(fields.interestRatePctDaily),
    interestRatePctMonthly: decimal(fields.interestRatePctMonthly),
    cancellationFeePct: decimal(fields.cancellationFeePct),
    materialPriceCents: Math.round(decimal(fields.materialPriceCents) * CENTS_PER_REAL),
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
