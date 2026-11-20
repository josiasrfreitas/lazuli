import { z, civilDateSchema, timeOfDaySchema } from "@lazuli/validators";

const MAX_WEEKDAYS = 7;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 2000;
const MAX_RECURRENCE_DAYS = 183;
const MILLISECONDS_PER_DAY = 86_400_000;

const id = z.string().uuid();
export const extraClassesSchema = z
  .object({
    id,
    classId: id,
    teacherId: id,
    from: civilDateSchema,
    through: civilDateSchema,
    weekdays: z
      .array(z.enum(["1", "2", "3", "4", "5", "6", "7"]))
      .min(1)
      .max(MAX_WEEKDAYS),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    reason: z
      .string()
      .trim()
      .min(MIN_REASON_LENGTH, "Explique o motivo das aulas extras.")
      .max(MAX_REASON_LENGTH),
    allowOutsidePeriod: z.boolean(),
    fingerprint: z.string().optional(),
  })
  .strict()
  .refine((input) => input.endTime > input.startTime, "O fim deve ser depois do início.")
  .refine(
    (input) =>
      input.through >= input.from &&
      Date.parse(input.through) - Date.parse(input.from) <=
        MAX_RECURRENCE_DAYS * MILLISECONDS_PER_DAY,
    "Escolha um intervalo de até seis meses.",
  );
export const endClassesSchema = z
  .object({
    classId: id,
    lastDate: civilDateSchema,
    reason: z
      .string()
      .trim()
      .min(MIN_REASON_LENGTH, "Explique o motivo do encerramento.")
      .max(MAX_REASON_LENGTH),
  })
  .strict();
export const confirmEndClassesSchema = endClassesSchema.extend({
  fingerprint: z.string().min(1),
  confirmation: z.string(),
});
export type ExtraClassesInput = z.infer<typeof extraClassesSchema>;
export type EndClassesInput = z.infer<typeof endClassesSchema>;
