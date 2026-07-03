import { z } from "zod";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_TIME_MESSAGE = "Horario invalido.";

const requiredText = z.string().trim().min(1, REQUIRED_TEXT_MESSAGE);

export const weekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const classScheduleTypeSchema = z.enum(["REGULAR", "PERSONALIZED"]);
export const classFormatSchema = z.enum(["IN_PERSON", "ONLINE"]);

/** HH:mm wall-clock time used in schedule slots and Portal name derivation. */
export const timeOfDaySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, INVALID_TIME_MESSAGE);

export const classScheduleSlotInputSchema = z
  .object({
    weekday: weekdaySchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startTime >= value.endTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horario de inicio deve ser anterior ao horario de termino.",
        path: ["endTime"],
      });
    }
  });

export const classCreateInputSchema = z
  .object({
    internalCode: requiredText,
    teacherId: requiredText.uuid("Identificador de professor invalido."),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    sharedStageId: z.string().uuid("Identificador de etapa invalido.").nullish(),
    semesterId: z.string().uuid("Identificador de semestre invalido.").nullish(),
    year: z.number().int().min(2000).max(2100),
    capacity: z.number().int().min(1),
    portalClassName: requiredText.optional(),
    slots: z.array(classScheduleSlotInputSchema).min(1, "Informe ao menos um horario."),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scheduleType === "REGULAR") {
      if (value.portalClassName != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Turma regular nao aceita nome Portal manual.",
          path: ["portalClassName"],
        });
      }
      if (value.sharedStageId == null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Turma regular exige etapa compartilhada.",
          path: ["sharedStageId"],
        });
      }
      if (value.semesterId == null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Turma regular exige semestre.",
          path: ["semesterId"],
        });
      }
      return;
    }

    if (value.sharedStageId != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Turma personalizada nao pode ter etapa compartilhada.",
        path: ["sharedStageId"],
      });
    }

    if (value.portalClassName == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Turma personalizada exige nome Portal manual.",
        path: ["portalClassName"],
      });
    }
  });

export const classIdInputSchema = z
  .object({
    id: z.string().uuid("Identificador de turma invalido."),
  })
  .strict();

export const classCloneForNextPeriodInputSchema = z
  .object({
    id: z.string().uuid("Identificador de turma invalido."),
    internalCode: requiredText,
    semesterId: z.string().uuid("Identificador de semestre invalido."),
    year: z.number().int().min(2000).max(2100),
    sharedStageId: z.string().uuid("Identificador de etapa invalido.").optional(),
    portalClassName: requiredText.optional(),
  })
  .strict();

export const classArchiveInputSchema = classIdInputSchema;
