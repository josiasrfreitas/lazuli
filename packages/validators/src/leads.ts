import { z } from "zod";
import { placementScheduleSchema } from "./placement.js";
import { civilDateSchema } from "./civil-date.js";
import { classFormatSchema, classScheduleTypeSchema } from "./class.js";

const MAX_NOTES_LENGTH = 2000;

const MAX_NAME = 160;
const optionalText = z.string().trim().max(MAX_NAME).nullable();
export const leadInterestSchema = z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]);

export const leadCaptureSchema = z
  .object({
    id: z.string().uuid(),
    fullName: z.string().trim().min(1, "Informe o nome do futuro aluno.").max(MAX_NAME),
    phone: optionalText,
    email: z.union([z.string().trim().email(), z.literal("")]).nullable(),
    contactName: optionalText,
    source: optionalText,
    notes: z
      .string()
      .trim()
      .max(MAX_NOTES_LENGTH, "Use até 2.000 caracteres nas observações.")
      .nullable()
      .optional(),
    interest: leadInterestSchema.default("UNKNOWN"),
    contactRole: z.enum(["STUDENT", "GUARDIAN"]).default("STUDENT"),
    contactOwner: z.enum(["STUDENT", "GUARDIAN"]).default("STUDENT"),
    birthDate: civilDateSchema.nullable().default(null),
    englishExperience: z.enum(["NONE", "SOME", "UNKNOWN"]).default("UNKNOWN"),
    stageId: z.string().uuid().nullable().default(null),
    format: classFormatSchema.nullable().default(null),
    scheduleType: classScheduleTypeSchema.nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.contactRole === "GUARDIAN" || value.contactOwner === "GUARDIAN") &&
      !value.contactName
    )
      context.addIssue({
        code: "custom",
        path: ["contactName"],
        message: "Informe o nome do responsável.",
      });
    if (value.englishExperience === "NONE" && !value.stageId)
      context.addIssue({
        code: "custom",
        path: ["stageId"],
        message: "Escolha o estágio inicial.",
      });
    if (!value.phone && !value.email)
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Informe telefone ou e-mail para contato.",
      });
  });

export const leadRegistrationSchema = z
  .object({
    lead: leadCaptureSchema,
    placement: placementScheduleSchema.nullable().default(null),
    allowPending: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.placement &&
      (value.placement.candidateId !== value.lead.id || value.lead.englishExperience !== "SOME")
    )
      context.addIssue({
        code: "custom",
        path: ["placement"],
        message: "O agendamento deve pertencer a este lead com nivelamento.",
      });
    if (value.lead.englishExperience === "SOME" && !value.placement && !value.allowPending)
      context.addIssue({
        code: "custom",
        path: ["allowPending"],
        message: "Confirme o cadastro com nivelamento pendente.",
      });
  });
