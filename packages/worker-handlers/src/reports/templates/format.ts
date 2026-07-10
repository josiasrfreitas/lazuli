/**
 * pt-BR value formatters for generated reports (§8: Portuguese-BR is mandatory
 * for generated reports). Money is integer BRL cents; date-only fields are
 * compared/rendered as calendar dates; instants render in America/Sao_Paulo.
 */

import { saoPauloDateOnly } from "@lazuli/domain";

const CENTS_PER_REAL = 100;
const DATE_ONLY_LENGTH = 10;
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const PERCENT_FRACTION_DIGITS = 1;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: PERCENT_FRACTION_DIGITS,
});

const instantFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

type DateOnlyInput = Date | string;

/** `123456` → `"R$ 1.234,56"`; `0` → `"R$ 0,00"`; negatives keep the sign. */
export function formatCentsBRL(cents: number): string {
  return currencyFormatter.format(cents / CENTS_PER_REAL);
}

/** `123456` → `"1.234,56"` — bare decimal for CSV money columns. */
export function formatCentsDecimalPtBr(cents: number): string {
  return decimalFormatter.format(cents / CENTS_PER_REAL);
}

/** A `@db.Date` value (UTC-midnight `Date` or `"YYYY-MM-DD"`) → `"dd/mm/aaaa"`. */
export function formatDateOnlyPtBr(value: DateOnlyInput): string {
  const dateOnly =
    value instanceof Date
      ? value.toISOString().slice(0, DATE_ONLY_LENGTH)
      : value.slice(0, DATE_ONLY_LENGTH);
  const [year, month, day] = dateOnly.split("-");

  return `${day ?? ""}/${month ?? ""}/${year ?? ""}`;
}

/** An instant → `"dd/mm/aaaa HH:mm"` wall clock in America/Sao_Paulo. */
export function formatInstantPtBr(instant: Date): string {
  return instantFormatter.format(instant).replace(",", "");
}

/** An instant → the America/Sao_Paulo calendar day as `"dd/mm/aaaa"`. */
export function formatInstantDatePtBr(instant: Date): string {
  return formatDateOnlyPtBr(saoPauloDateOnly(instant));
}

/** Fraction in `[0, 1]` → `"87,5%"`; `null` renders as `"sem dados"` (§4.6). */
export function formatPercentPtBr(fraction: number | null): string {
  if (fraction === null) {
    return "sem dados";
  }

  return percentFormatter.format(fraction);
}
