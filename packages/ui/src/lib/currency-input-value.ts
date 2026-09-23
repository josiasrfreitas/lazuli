const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** A null value is empty; every integer represents that many centavos. */
export function formatCurrencyCents(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `R$ ${integerFormatter.format(whole)},${fraction}`;
}

/** Extract centavos from typed or pasted text; undefined means the value is too large. */
export function parseCurrencyDigits(text: string): number | null | undefined {
  const digits = text.replace(/\D/gu, "");
  if (!digits) return null;
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

export function appendCurrencyDigit(cents: number | null, digit: string): number | null {
  const next = (cents ?? 0) * 10 + Number(digit);
  return Number.isSafeInteger(next) ? next : cents;
}

export function removeCurrencyDigit(cents: number | null): number | null {
  if (cents === null || cents < 10) return null;
  return Math.floor(cents / 10);
}
