import { z } from "zod";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_TIME_MESSAGE = "Horario invalido.";
const INVALID_CLASS_ID_MESSAGE = "Identificador de turma invalido.";
const INVALID_SEMESTER_ID_MESSAGE = "Identificador de semestre invalido.";
const MIN_CLASS_YEAR = 2000;
const MAX_CLASS_YEAR = 2100;

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
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE).nullish(),
    year: z.number().int().min(MIN_CLASS_YEAR).max(MAX_CLASS_YEAR),
    capacity: z.number().int().min(1),
    portalClassName: requiredText.optional(),
    slots: z.array(classScheduleSlotInputSchema).min(1, "Informe ao menos um horario."),
  })
  .strict()
  .superRefine(validateClassCreateInput);

export const classIdInputSchema = z
  .object({
    id: z.string().uuid(INVALID_CLASS_ID_MESSAGE),
  })
  .strict();

export const classCloneForNextPeriodInputSchema = z
  .object({
    id: z.string().uuid(INVALID_CLASS_ID_MESSAGE),
    internalCode: requiredText,
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE),
    year: z.number().int().min(MIN_CLASS_YEAR).max(MAX_CLASS_YEAR),
    sharedStageId: z.string().uuid("Identificador de etapa invalido.").optional(),
    portalClassName: requiredText.optional(),
  })
  .strict();

export const classArchiveInputSchema = classIdInputSchema;

export const classGenerateSessionsInputSchema = z
  .object({
    classId: z.string().uuid(INVALID_CLASS_ID_MESSAGE).optional(),
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.classId === undefined) === (input.semesterId === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe uma turma ou um semestre.",
      });
    }
  });

type ClassCreateInput = {
  scheduleType: z.infer<typeof classScheduleTypeSchema>;
  sharedStageId?: string | null | undefined;
  semesterId?: string | null | undefined;
  portalClassName?: string | null | undefined;
};

function validateClassCreateInput(input: ClassCreateInput, context: z.RefinementCtx): void {
  if (input.scheduleType === "REGULAR") {
    validateRegularClassInput(input, context);
    return;
  }

  validatePersonalizedClassInput(input, context);
}

function validateRegularClassInput(input: ClassCreateInput, context: z.RefinementCtx): void {
  if (input.portalClassName !== null && input.portalClassName !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma regular nao aceita nome Portal manual.",
      path: ["portalClassName"],
    });
  }
  if (input.sharedStageId === null || input.sharedStageId === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma regular exige etapa compartilhada.",
      path: ["sharedStageId"],
    });
  }
  if (input.semesterId === null || input.semesterId === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma regular exige semestre.",
      path: ["semesterId"],
    });
  }
}

function validatePersonalizedClassInput(input: ClassCreateInput, context: z.RefinementCtx): void {
  if (input.sharedStageId !== null && input.sharedStageId !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma personalizada nao pode ter etapa compartilhada.",
      path: ["sharedStageId"],
    });
  }

  if (input.portalClassName === null || input.portalClassName === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma personalizada exige nome Portal manual.",
      path: ["portalClassName"],
    });
  }

  if (input.semesterId === null || input.semesterId === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Turma personalizada exige semestre.",
      path: ["semesterId"],
    });
  }
}
