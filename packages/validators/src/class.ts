import { z } from "zod";

const REQUIRED_TEXT_MESSAGE = "Campo obrigatorio.";
const INVALID_TIME_MESSAGE = "Horario invalido.";
const INVALID_CLASS_ID_MESSAGE = "Identificador de turma invalido.";
const INVALID_SEMESTER_ID_MESSAGE = "Identificador de semestre invalido.";
const MAX_CLASS_PAGE_SIZE = 100;
const DEFAULT_CLASS_PAGE_SIZE = 20;
const MAX_CLASS_SEARCH_LENGTH = 80;
const MINUTES_PER_HOUR = 60;
const MAX_WEEKLY_CLASS_MINUTES = 120;

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

export const classScheduleSlotsInputSchema = z
  .array(classScheduleSlotInputSchema)
  .min(1, "Informe ao menos um horario.")
  .superRefine((slots, context) => {
    const minutes = slots.reduce(
      (total, slot) => total + timeInMinutes(slot.endTime) - timeInMinutes(slot.startTime),
      0,
    );
    if (minutes > MAX_WEEKLY_CLASS_MINUTES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A turma pode ter no máximo 2 horas por semana.",
      });
    }
  });

export const classCreateInputSchema = z
  .object({
    teacherId: requiredText.uuid("Identificador de professor invalido."),
    scheduleType: classScheduleTypeSchema,
    format: classFormatSchema,
    sharedStageId: z.string().uuid("Identificador de etapa invalido.").nullish(),
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE).nullish(),
    portalClassName: requiredText.optional(),
    slots: classScheduleSlotsInputSchema,
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
    semesterId: z.string().uuid(INVALID_SEMESTER_ID_MESSAGE),
    sharedStageId: z.string().uuid("Identificador de etapa invalido.").optional(),
    portalClassName: requiredText.optional(),
  })
  .strict();

export const classArchiveInputSchema = classIdInputSchema;

export const classListInputSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_CLASS_PAGE_SIZE).default(DEFAULT_CLASS_PAGE_SIZE),
    search: z.string().trim().max(MAX_CLASS_SEARCH_LENGTH).default(""),
    scheduleTypes: z.array(classScheduleTypeSchema).default([]),
    formats: z.array(classFormatSchema).default([]),
    teacherIds: z.array(z.string().uuid()).default([]),
    stageIds: z.array(z.string().uuid()).default([]),
    semesterIds: z.array(z.string().uuid()).default([]),
    statuses: z.array(z.enum(["ACTIVE", "ARCHIVED"])).default([]),
  })
  .strict();

export const classRelatedListInputSchema = classIdInputSchema
  .extend({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_CLASS_PAGE_SIZE).default(DEFAULT_CLASS_PAGE_SIZE),
  })
  .strict();

export const classRosterInputSchema = classRelatedListInputSchema
  .extend({
    search: z.string().trim().max(MAX_CLASS_SEARCH_LENGTH).default(""),
    situations: z.array(z.enum(["CURRENT", "SCHEDULED", "PAUSED", "ENDED"])).default([]),
  })
  .strict();

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

  if (input.portalClassName !== null && input.portalClassName !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O nome da turma PPT é gerado automaticamente.",
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

function timeInMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * MINUTES_PER_HOUR + (minutes ?? 0);
}
