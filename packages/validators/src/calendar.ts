import { z } from "zod";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_DATE_MESSAGE = "Data invalida.";
const INVALID_YEAR_MESSAGE = "Ano invalido.";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MAX_REASON_LENGTH = 160;
const MONTH_INDEX_OFFSET = 1;

export const calendarYearSchema = z
  .number({ invalid_type_error: INVALID_YEAR_MESSAGE })
  .int(INVALID_YEAR_MESSAGE)
  .min(MIN_YEAR, INVALID_YEAR_MESSAGE)
  .max(MAX_YEAR, INVALID_YEAR_MESSAGE);

export const calendarDateSchema = z
  .string({ required_error: INVALID_DATE_MESSAGE })
  .regex(DATE_ONLY_PATTERN, INVALID_DATE_MESSAGE)
  .refine(isRealDateOnly, INVALID_DATE_MESSAGE);

export const closedDayReasonSchema = z
  .string()
  .trim()
  .min(1, REQUIRED_TEXT_MESSAGE)
  .max(MAX_REASON_LENGTH);

export const importBrazilFederalHolidaysInputSchema = z
  .object({ year: calendarYearSchema })
  .strict();

export const addClosedDayInputSchema = z
  .object({
    date: calendarDateSchema,
    reason: closedDayReasonSchema,
  })
  .strict();

export const removeClosedDayInputSchema = z.object({ date: calendarDateSchema }).strict();

function isRealDateOnly(value: string): boolean {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - MONTH_INDEX_OFFSET, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - MONTH_INDEX_OFFSET &&
    date.getUTCDate() === day
  );
}
