export function dateLabel(value: string | Date): string {
  const date = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return date.split("-").reverse().join("/");
}
export function hoursLabel(minutes: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(minutes / 60);
}
export function mondayOf(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function shiftDay(value: string, count: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function todayInSchool(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function safeTeacherReturn(value: string | null): string {
  if (!value) return "/professores";
  let url: URL;
  try {
    url = new URL(value, "https://lazuli.local");
  } catch {
    return "/professores";
  }
  return url.origin === "https://lazuli.local" &&
    /^\/(professores|turmas)(\/|$)/u.test(url.pathname)
    ? `${url.pathname}${url.search}`
    : "/professores";
}
