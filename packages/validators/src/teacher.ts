import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
import { detectPersonDocument } from "./person-document.js";

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

export const teacherCreateInputSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome."),
    cpf,
    email: z
      .string()
      .trim()
      .email("E-mail inválido.")
      .transform((value) => value.toLowerCase()),
    isEnabled: z.boolean().default(false),
  })
  .strict();

export const teacherUpdateInputSchema = teacherCreateInputSchema.extend({ id });
export const teacherIdInputSchema = z.object({ id }).strict();
export const teacherListInputSchema = z
  .object({
    search: z.string().trim().max(80).default(""),
    active: z.enum(["all", "active", "scheduled", "departed"]).default("all"),
    access: z.enum(["all", "enabled", "disabled"]).default("all"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
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
