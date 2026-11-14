const ISO_DATE_LENGTH = 10;
const DAY_MILLISECONDS = 86_400_000;
export const civil = (date: Date): string => date.toISOString().slice(0, ISO_DATE_LENGTH);
export const day = (date: string): Date => new Date(`${date}T00:00:00Z`);
export function datesBetween(from: string, through: string): string[] {
  const dates: string[] = [];
  for (let current = Date.parse(from); current <= Date.parse(through); current += DAY_MILLISECONDS)
    dates.push(civil(new Date(current)));
  return dates;
}
