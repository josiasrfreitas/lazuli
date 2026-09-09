import { saoPauloDateOnly } from "@lazuli/domain";

const ADULT_AGE_YEARS = 18;
const DATE_ONLY_LENGTH = "yyyy-mm-dd".length;
const YEAR_START_INDEX = 0;
const YEAR_END_INDEX = 4;

export type IsMinorInSaoPauloInput = {
  birthDate: Date | null | undefined;
  now: Date;
};

export function isMinorInSaoPaulo(input: IsMinorInSaoPauloInput): boolean {
  if (input.birthDate === null || input.birthDate === undefined) {
    return false;
  }

  const birthDateOnly = input.birthDate.toISOString().slice(0, DATE_ONLY_LENGTH);
  return birthDateOnly > adultCutoffDateOnly(input.now);
}

export function isMinorTodayInSaoPaulo(birthDate: Date | null | undefined): boolean {
  return isMinorInSaoPaulo({ birthDate, now: new Date() });
}

export function toDateOnlyString(date: Date): string;
export function toDateOnlyString(date: null): null;
export function toDateOnlyString(date: Date | null): string | null;
export function toDateOnlyString(date: Date | null): string | null {
  if (date === null) {
    return null;
  }

  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
}

function adultCutoffDateOnly(now: Date): string {
  const today = saoPauloDateOnly(now);
  const cutoffYear = Number(today.slice(YEAR_START_INDEX, YEAR_END_INDEX)) - ADULT_AGE_YEARS;

  return `${String(cutoffYear)}${today.slice(YEAR_END_INDEX)}`;
}
