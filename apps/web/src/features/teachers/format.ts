const TEACHER_LIST_PATH = "/professores";
const ISO_DATE_LENGTH = 10;
const MINUTES_PER_HOUR = 60;
const DAYS_AFTER_MONDAY = 6;
const DAYS_PER_WEEK = 7;

export function dateLabel(value: string | Date): string {
  const date =
    typeof value === "string"
      ? value.slice(0, ISO_DATE_LENGTH)
      : value.toISOString().slice(0, ISO_DATE_LENGTH);
  return date.split("-").toReversed().join("/");
}
export function hoursLabel(minutes: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    minutes / MINUTES_PER_HOUR,
  );
}
export function mondayOf(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + DAYS_AFTER_MONDAY) % DAYS_PER_WEEK));
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}
export function shiftDay(value: string, count: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}
export function todayInSchool(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string): string => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function safeTeacherReturn(value: string | null): string {
  if (!value) return TEACHER_LIST_PATH;
  let url: URL;
  try {
    url = new URL(value, "https://lazuli.local");
  } catch {
    return TEACHER_LIST_PATH;
  }
  return url.origin === "https://lazuli.local" &&
    /^\/(professores|turmas)(\/|$)/u.test(url.pathname)
    ? `${url.pathname}${url.search}`
    : TEACHER_LIST_PATH;
}
