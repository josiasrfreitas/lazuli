import { saoPauloDateOnly } from "@lazuli/domain";

const ADULT_AGE_YEARS = 18;
const DECIMAL_RADIX = 10;

export function isMinorInSaoPaulo(birthDate: Date | null | undefined): boolean {
  if (birthDate === null || birthDate === undefined) {
    return false;
  }

  const birthDateOnly = toDateOnlyString(birthDate);
  if (birthDateOnly === null) {
    return false;
  }

  return birthDateOnly > adultCutoffDateOnly();
}

export function toDateOnlyString(date: Date | null): string | null {
  if (date === null) {
    return null;
  }

  return date.toISOString().slice(0, "yyyy-mm-dd".length);
}

function adultCutoffDateOnly(): string {
  const today = saoPauloDateOnly(new Date());
  const cutoffYear =
    Number.parseInt(today.slice(0, "yyyy".length), DECIMAL_RADIX) - ADULT_AGE_YEARS;

  return `${String(cutoffYear)}${today.slice("yyyy".length)}`;
}
