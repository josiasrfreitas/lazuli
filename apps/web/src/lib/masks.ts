/**
 * Input masks for Brazilian formats. Pure string → string, safe to run on every
 * keystroke: they keep only digits and re-insert the separators, so pasting
 * "02092008" or "02/09/2008" ends the same way.
 */

const NON_DIGITS = /\D/g;
const DATE_DIGITS = 8;
const DAY_END = 2;
const MONTH_END = 4;
const PHONE_MAX_DIGITS = 11;
const PHONE_AREA_END = 2;
const PHONE_LANDLINE_DIGITS = 10;
const PHONE_LANDLINE_PREFIX_END = 6;
const PHONE_MOBILE_PREFIX_END = 7;
const MIN_YEAR = 1900;
const MONTHS_PER_YEAR = 12;
const ISO_DATE_LENGTH = 10;

function digitsOf(raw: string, max: number): string {
  return raw.replaceAll(NON_DIGITS, "").slice(0, max);
}

/** `"02092008"` → `"02/09/2008"`; partial input keeps only the separators it has earned. */
export function maskDateBR(raw: string): string {
  const digits = digitsOf(raw, DATE_DIGITS);
  const day = digits.slice(0, DAY_END);
  const month = digits.slice(DAY_END, MONTH_END);
  const year = digits.slice(MONTH_END);

  if (digits.length <= DAY_END) {
    return day;
  }
  if (digits.length <= MONTH_END) {
    return `${day}/${month}`;
  }

  return `${day}/${month}/${year}`;
}

/**
 * `"02/09/2008"` → `"2008-09-02"`. Returns `null` for anything that is not a
 * complete, real calendar date (31/02, year before 1900, partial input).
 */
export function parseDateBR(text: string): string | null {
  const digits = digitsOf(text, DATE_DIGITS);

  if (digits.length !== DATE_DIGITS) {
    return null;
  }

  const day = Number(digits.slice(0, DAY_END));
  const month = Number(digits.slice(DAY_END, MONTH_END));
  const year = Number(digits.slice(MONTH_END));

  if (year < MIN_YEAR || month < 1 || month > MONTHS_PER_YEAR || day < 1) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return null;
  }

  return candidate.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** `"11999998888"` → `"(11) 99999-8888"`; ten digits format as a landline. */
export function maskPhoneBR(raw: string): string {
  const digits = digitsOf(raw, PHONE_MAX_DIGITS);

  if (digits.length === 0) {
    return "";
  }

  const area = digits.slice(0, PHONE_AREA_END);
  const rest = digits.slice(PHONE_AREA_END);

  if (digits.length <= PHONE_AREA_END) {
    return `(${area}`;
  }

  const prefixEnd =
    digits.length <= PHONE_LANDLINE_DIGITS
      ? PHONE_LANDLINE_PREFIX_END - PHONE_AREA_END
      : PHONE_MOBILE_PREFIX_END - PHONE_AREA_END;
  const prefix = rest.slice(0, prefixEnd);
  const line = rest.slice(prefixEnd);

  return line.length === 0 ? `(${area}) ${prefix}` : `(${area}) ${prefix}-${line}`;
}
