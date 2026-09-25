const CPF_LENGTH = 11;
const CPF_BASE_LENGTH = 9;
const CHECKSUM_MODULUS = 11;
const DOCUMENT_GROUP_LENGTH = 3;
const CPF_SECOND_GROUP_END = 6;

type DetectedDocument = { documentType: "CPF" | "RG" | undefined; documentNumber: string };

function cpfDigit(base: string): string {
  let sum = 0;
  for (let index = 0; index < base.length; index++) {
    sum += Number(base.charAt(index)) * (base.length + 1 - index);
  }
  const remainder = sum % CHECKSUM_MODULUS;
  return String(remainder < 2 ? 0 : CHECKSUM_MODULUS - remainder);
}

function isCpf(value: string): boolean {
  if (value.length !== CPF_LENGTH || !/^\d+$/u.test(value) || /^(\d)\1{10}$/u.test(value))
    return false;
  const base = value.slice(0, CPF_BASE_LENGTH);
  const first = cpfDigit(base);
  return value === base + first + cpfDigit(base + first);
}

/** RG is a format-based fallback, not a verification against state-specific algorithms. */
export function detectPersonDocument(value: string): DetectedDocument {
  const clean = value.replaceAll(/[\s.-]/gu, "").toUpperCase();
  if (isCpf(clean)) {
    return {
      documentType: "CPF",
      documentNumber: `${clean.slice(0, DOCUMENT_GROUP_LENGTH)}.${clean.slice(DOCUMENT_GROUP_LENGTH, CPF_SECOND_GROUP_END)}.${clean.slice(CPF_SECOND_GROUP_END, CPF_BASE_LENGTH)}-${clean.slice(CPF_BASE_LENGTH)}`,
    };
  }
  if (/^\d{6,13}[\dX]$/u.test(clean)) {
    const body = clean.slice(0, -1);
    const groups: string[] = [];
    for (let end = body.length; end > 0; end -= DOCUMENT_GROUP_LENGTH) {
      groups.unshift(body.slice(Math.max(0, end - DOCUMENT_GROUP_LENGTH), end));
    }
    return { documentType: "RG", documentNumber: `${groups.join(".")}-${clean.at(-1)}` };
  }
  return { documentType: undefined, documentNumber: clean };
}
