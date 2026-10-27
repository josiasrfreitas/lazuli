import type { IdentityField } from "./types.js";
import { normalized } from "./profiles.js";

const CPF_LENGTH = 11;
const CPF_BASE_LENGTH = 9;
const MODULUS = 11;
const MIN_YEAR = 1900;
const ISO_DATE_LENGTH = 10;
export interface ParsedValue {
  value: string;
  valid: boolean;
  warnings: string[];
}
function cpfDigit(base: string): string {
  let sum = 0;
  for (const [index, digit] of [...base].entries())
    sum += Number(digit) * (base.length + 1 - index);
  const remainder = sum % MODULUS;
  return String(remainder < 2 ? 0 : MODULUS - remainder);
}
function cpfValue(text: string): ParsedValue | undefined {
  // Separators are presentation; keep digits exact and validate their checksum.
  if (!/^[\d\s.\-–—/]+$/u.test(text)) return undefined;
  const digits = text.replaceAll(/\D/gu, "");
  if (digits.length !== CPF_LENGTH) return undefined;
  const base = digits.slice(0, CPF_BASE_LENGTH);
  const first = cpfDigit(base);
  const valid =
    digits.length === CPF_LENGTH &&
    !/^(\d)\1+$/u.test(digits) &&
    digits === base + first + cpfDigit(base + first);
  return {
    value: digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/u, "$1.$2.$3-$4"),
    valid,
    warnings: valid ? [] : ["cpf_checksum_failed"],
  };
}
function validBirthDate({
  iso,
  parsed,
  year,
  today,
}: {
  iso: string;
  parsed: Date;
  year: string;
  today: string;
}): boolean {
  return (
    Number(year) >= MIN_YEAR &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, ISO_DATE_LENGTH) === iso &&
    iso <= today
  );
}
function birthValue(text: string, today: string): ParsedValue | undefined {
  if (/^(?:\d{2}[/.-])?\d{4}$/u.test(text) || text === "NAO CONSTA") {
    return { value: text, valid: false, warnings: ["incomplete_birth_date"] };
  }
  const match = /^(\d{1,2})\s*[/.,\s–—-]\s*(\d{1,2})\s*[/.,\s–—-]\s*(\d{4})$/u.exec(text);
  if (!match) return undefined;
  const [, day = "", month = "", year = ""] = match;
  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");
  const iso = `${year}-${paddedMonth}-${paddedDay}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  const valid = validBirthDate({ iso, parsed, year, today });
  return {
    value: `${paddedDay}/${paddedMonth}/${year}`,
    valid,
    warnings: valid ? [] : ["invalid_birth_date"],
  };
}
function rgValue(text: string): ParsedValue | undefined {
  // State formats vary; preserve the observed representation, including alphabetic prefixes.
  if (!/^(?:[A-Z]{1,3}[.\-–— ]*)?\d[\d.\-–— ]{3,20}[\dX]$/u.test(text)) return undefined;
  if (cpfValue(text)?.valid) return undefined;
  // A date near the RG label is usually an issue date, never an identity number.
  if (/^\d{1,2}[.\-–— ]+\d{1,2}[.\-–— ]+\d{4}$/u.test(text)) return undefined;
  return { value: text, valid: true, warnings: ["rg_format_only"] };
}
function nameValue(text: string): ParsedValue | undefined {
  if (!/^[\p{L}][\p{L} .’'-]*\s[\p{L} .’'-]+$/u.test(text)) return undefined;
  return { value: text, valid: true, warnings: [] };
}
export function parseFieldValue(input: {
  field: IdentityField;
  raw: string;
  today: string;
}): ParsedValue | undefined {
  const text = normalized(input.raw)
    .replaceAll(/^[\s:;|]+|[\s;|]+$/gu, "")
    .trim();
  switch (input.field) {
    case "cpf": {
      return cpfValue(text);
    }
    case "birthDate": {
      return birthValue(text, input.today);
    }
    case "rg": {
      return rgValue(text);
    }
    case "name": {
      return nameValue(input.raw.replaceAll(/\s+/gu, " ").trim());
    }
  }
}
