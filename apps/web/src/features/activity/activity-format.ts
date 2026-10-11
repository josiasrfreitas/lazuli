import type { RouterOutputs } from "@lazuli/api";

export type Activity = RouterOutputs["activity"]["list"]["rows"][number];
type ActivityDay = { key: string; label: string; date: string; rows: Activity[] };
const timeZone = "America/Sao_Paulo";
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayName = new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
const timestamp = new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  dateStyle: "long",
  timeStyle: "medium",
});
export const activityTime = (date: Date): string => time.format(date);
export const activityTimestamp = (date: Date): string => timestamp.format(date);

export function activityDays(rows: Activity[], now: Date): ActivityDay[] {
  const today = dayKey.format(now);
  const yesterday = new Date(`${today}T12:00:00-03:00`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const previousDay = dayKey.format(yesterday);
  const groups = new Map<string, ActivityDay>();
  for (const row of rows) {
    const key = dayKey.format(row.occurredAt);
    let group = groups.get(key);
    if (!group) {
      const date = dayName.format(row.occurredAt);
      group = {
        key,
        label: key === today ? "Hoje" : key === previousDay ? "Ontem" : date,
        date,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}
