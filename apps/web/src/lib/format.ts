/**
 * Presentation formatters shared by the whole app. Money arrives from the BFF in
 * cents and dates as instants; both are rendered in pt-BR / America/São_Paulo so
 * the secretary reads the same values the school works with. Missing data is an
 * em dash — never a fake zero.
 */

const CENTS_PER_UNIT = 100;
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
  timeZone: SAO_PAULO_TIME_ZONE,
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Rendered when a fact is absent (no class, no attendance data, no order). */
export const EM_DASH = "—";

export function formatBRLFromCents(cents: number): string {
  return brlFormatter.format(cents / CENTS_PER_UNIT);
}

/** e.g. "segunda-feira, 24 de agosto de 2026" — the topbar date. */
export function formatLongDateSaoPaulo(date: Date): string {
  return longDateFormatter.format(date);
}

/** `percent` is a fraction in [0, 1]; null means "sem dados". */
export function formatAttendancePercent(percent: number | null): string {
  return percent === null ? EM_DASH : percentFormatter.format(percent);
}

export { toWhatsAppUrl } from "@lazuli/domain";
