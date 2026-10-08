import { z } from "zod";
import { CIVIL_DATE_PATTERN, isRealCivilDate } from "./civil-date.js";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_DATE_MESSAGE = "Data invalida.";
const INVALID_YEAR_MESSAGE = "Ano invalido.";
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MAX_REASON_LENGTH = 160;
const MIN_CIVIL_YEAR = 100;

export const calendarYearSchema = z
  .number({ invalid_type_error: INVALID_YEAR_MESSAGE })
  .int(INVALID_YEAR_MESSAGE)
  .min(MIN_YEAR, INVALID_YEAR_MESSAGE)
  .max(MAX_YEAR, INVALID_YEAR_MESSAGE);

export const calendarDateSchema = z
  .string({ required_error: INVALID_DATE_MESSAGE })
  .regex(CIVIL_DATE_PATTERN, INVALID_DATE_MESSAGE)
  .refine(
    (value) => Number(value.slice(0, 4)) >= MIN_CIVIL_YEAR && isRealCivilDate(value),
    INVALID_DATE_MESSAGE,
  );

export const closedDayReasonSchema = z
  .string()
  .trim()
  .min(1, REQUIRED_TEXT_MESSAGE)
  .max(MAX_REASON_LENGTH);

export const importBrazilFederalHolidaysInputSchema = z
  .object({ year: calendarYearSchema })
  .strict();

export const createSemesterInputSchema = z
  .object({
    name: z.string().trim().min(1, REQUIRED_TEXT_MESSAGE),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.startDate > input.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data inicial deve ser anterior ou igual a data final.",
        path: ["endDate"],
      });
    }
  });

export const addClosedDayInputSchema = z
  .object({
    date: calendarDateSchema,
    reason: closedDayReasonSchema,
  })
  .strict();

export const removeClosedDayInputSchema = z.object({ date: calendarDateSchema }).strict();
