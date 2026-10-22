import { monday, shiftDate } from "./calendar-model";

const YEAR_MONTH_LENGTH = 7;
const DAYS_PER_WEEK = 7;
const LAST_WEEKDAY = 6;
const MONTHS_PER_YEAR = 12;

export function adjacentMonth(date: string, delta: number): string {
  const [year, month] = date.split("-").map(Number);
  const index = year! * MONTHS_PER_YEAR + month! - 1 + delta;
  return `${Math.floor(index / MONTHS_PER_YEAR)}-${String((index % MONTHS_PER_YEAR) + 1).padStart(2, "0")}-01`;
}

/** Include every Monday–Sunday week that intersects the displayed month. */
export function monthWeeks(date: string): { from: string; through: string; selectDate: string }[] {
  const first = `${date.slice(0, YEAR_MONTH_LENGTH)}-01`;
  const nextMonth = adjacentMonth(first, 1);
  const weeks = [];
  for (let from = monday(first); from < nextMonth; from = shiftDate(from, DAYS_PER_WEEK))
    weeks.push({
      from,
      through: shiftDate(from, LAST_WEEKDAY),
      selectDate: from.startsWith(date.slice(0, YEAR_MONTH_LENGTH)) ? from : first,
    });
  return weeks;
}
