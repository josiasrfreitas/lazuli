import { utcDate } from "./seed-dev-support.js";

/** Calendar-relative dates, clamped to the final day of the target month. */
export function monthlyDueDate(
  todayIso: string,
  input: { monthOffset: number; dueDay: number },
): Date {
  const today = utcDate(todayIso);
  const month = today.getUTCMonth() + input.monthOffset;
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(today.getUTCFullYear(), month, Math.min(input.dueDay, lastDay)));
}
