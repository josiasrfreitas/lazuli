const ADULT_AGE_YEARS = 18;
const DECIMAL_RADIX = 10;
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const saoPauloDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
});

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

export function todayDateOnlyInSaoPaulo(): string {
  const parts = saoPauloDateFormatter.formatToParts(new Date());
  const year = requireDatePart(parts.find((part) => part.type === "year")?.value);
  const month = requireDatePart(parts.find((part) => part.type === "month")?.value);
  const day = requireDatePart(parts.find((part) => part.type === "day")?.value);

  return [year, month, day].join("-");
}

function adultCutoffDateOnly(): string {
  const today = todayDateOnlyInSaoPaulo();
  const cutoffYear =
    Number.parseInt(today.slice(0, "yyyy".length), DECIMAL_RADIX) - ADULT_AGE_YEARS;

  return `${String(cutoffYear)}${today.slice("yyyy".length)}`;
}

function requireDatePart(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("Expected formatted Sao Paulo date part.");
  }

  return value;
}
