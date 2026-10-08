import { z } from "zod";

const DATE_ONLY_LENGTH = 10;
export const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isRealCivilDate(value: string): boolean {
  return (
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, DATE_ONLY_LENGTH) === value
  );
}

export const civilDateSchema = z
  .string()
  .regex(CIVIL_DATE_PATTERN)
  .refine(isRealCivilDate, "Data inválida.");
