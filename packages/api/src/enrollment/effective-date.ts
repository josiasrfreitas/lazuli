/** Date-only values are stored as UTC midnight; business "today" is resolved separately in São Paulo. */
const DATE_ONLY_LENGTH = 10;
export function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, DATE_ONLY_LENGTH);
}
