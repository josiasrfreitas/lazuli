import { z } from "zod";

const DATE_ONLY_LENGTH = 10;
export const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, DATE_ONLY_LENGTH) === value,
    "Data inválida.",
  );
