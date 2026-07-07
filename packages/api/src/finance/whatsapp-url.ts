const BRAZIL_COUNTRY_CODE = "55";
const EMPTY_TEXT = "";
const NON_DIGIT_PATTERN = /\D/g;

export function toWhatsAppUrl(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) {
    return null;
  }

  const digits = phone.replaceAll(NON_DIGIT_PATTERN, EMPTY_TEXT);
  if (digits.length === 0) {
    return null;
  }

  const target = digits.startsWith(BRAZIL_COUNTRY_CODE)
    ? digits
    : `${BRAZIL_COUNTRY_CODE}${digits}`;
  return `https://wa.me/${target}`;
}
