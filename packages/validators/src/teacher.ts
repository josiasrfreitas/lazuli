import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { detectPersonDocument } from "./person-document.js";
const MAX_SEARCH_LENGTH = 80;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const cpf = z.string().transform((value, context) => {
  const document = detectPersonDocument(value);
  if (document.documentType !== "CPF") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido." });
    return z.NEVER;
  }
  return document.documentNumber.replaceAll(/\D/gu, "");
});
const id = z.string().uuid();
const date = civilDateSchema;

const teacherFields = z
  .object({
    name: z.string().trim().min(2, "Informe o nome."),
    cpf,
    email: z
      .string()
      .trim()
      .email("E-mail inválido.")
      .transform((value) => value.toLowerCase()),
    isEnabled: z.boolean().default(false),
    documentSessionId: id.optional(),
    employmentType: z.enum(["CLT", "PJ", "AUTONOMOUS", "OTHER"]).nullish(),
    weeklyHours: z
      .number()
      .finite()
      .positive("Informe uma carga maior que zero.")
      .max(168)
      .nullish(),
    notes: z.string().trim().max(5000).nullish(),
    vacationStart: date.nullish(),
    vacationEnd: date.nullish(),
  })
  .strict();

function validateVacation(value: z.infer<typeof teacherFields>, context: z.RefinementCtx): void {
  if (!value.vacationStart && !value.vacationEnd) return;
  if (value.employmentType !== "CLT") {
    context.addIssue({
      code: "custom",
      path: ["employmentType"],
      message: "Previsão de férias disponível para vínculo CLT.",
    });
  }
  if (!value.vacationStart)
    context.addIssue({
      code: "custom",
      path: ["vacationStart"],
      message: "Informe o início das férias.",
    });
  if (!value.vacationEnd || (value.vacationStart && value.vacationEnd < value.vacationStart)) {
    context.addIssue({
      code: "custom",
      path: ["vacationEnd"],
      message: "Informe o fim das férias, a partir da data inicial.",
    });
  }
}
export const teacherCreateInputSchema = teacherFields.superRefine(validateVacation);
export const teacherUpdateInputSchema = teacherFields.extend({ id }).superRefine(validateVacation);
export const teacherFileUploadSchema = z
  .object({
    teacherId: id,
    kind: z.enum(["PHOTO", "ID", "CONTRACT", "OTHER"]),
    label: z.string().trim().min(1, "Informe o nome do documento.").max(100),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
  })
  .strict()
  .refine((value) => value.kind !== "PHOTO" || value.contentType !== "application/pdf", {
    message: "Escolha uma foto em JPG ou PNG.",
    path: ["contentType"],
  });
export const teacherIdInputSchema = z.object({ id }).strict();
export const teacherListInputSchema = z
  .object({
    search: z.string().trim().max(MAX_SEARCH_LENGTH).default(""),
    active: z.enum(["all", "active", "scheduled", "departed"]).default("all"),
    access: z.enum(["all", "enabled", "disabled"]).default("all"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();
export const teacherWeekInputSchema = z.object({ id, week: date }).strict();
export const teacherDepartureInputSchema = z
  .object({
    id,
    effectiveDate: date,
    token: z.string().optional(),
  })
  .strict();
export const classTeacherAssignInputSchema = z
  .object({
    classId: id,
    teacherId: id,
    effectiveDate: date,
  })
  .strict();
export const classSubstituteInputSchema = z
  .object({
    classId: id,
    scheduleSlotId: id.nullish(),
    classSessionId: id.nullish(),
    date,
    teacherId: id,
  })
  .strict()
  .refine(
    (value) => Boolean(value.scheduleSlotId) !== Boolean(value.classSessionId),
    "Informe um único encontro.",
  );
