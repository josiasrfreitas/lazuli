const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const CENTS_PER_REAL = 100;
const DIGIT_BASE = 10;

/** A null value is empty; every integer represents that many centavos. */
export function formatCurrencyCents(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.floor(cents / CENTS_PER_REAL);
  const fraction = String(cents % CENTS_PER_REAL).padStart(2, "0");
  return `R$ ${integerFormatter.format(whole)},${fraction}`;
}

/** Extract centavos from typed or pasted text; undefined means the value is too large. */
export function parseCurrencyDigits(text: string): number | null | undefined {
  const digits = text.replaceAll(/\D/gu, "");
  if (!digits) return null;
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

export function appendCurrencyDigit(cents: number | null, digit: string): number | null {
  const next = (cents ?? 0) * DIGIT_BASE + Number(digit);
  return Number.isSafeInteger(next) ? next : cents;
}

export function removeCurrencyDigit(cents: number | null): number | null {
  if (cents === null || cents < DIGIT_BASE) return null;
  return Math.floor(cents / DIGIT_BASE);
}
