import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";

const MIN_DESCRIPTION_LENGTH = 3;
const MAX_ACCOUNT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 160;
const MAX_SEARCH_LENGTH = 160;
const MAX_LINKED_OCCURRENCES = 50;

const id = z.string().uuid("Selecione uma opção válida.");
const body = z
  .string()
  .trim()
  .min(MIN_DESCRIPTION_LENGTH, "Descreva o contexto com mais detalhes.")
  .max(MAX_ACCOUNT_LENGTH);
const title = z
  .string()
  .trim()
  .min(MIN_DESCRIPTION_LENGTH, "Informe um título.")
  .max(MAX_TITLE_LENGTH);
export const occurrenceCategorySchema = z.enum([
  "MATERIAL",
  "HOMEWORK",
  "PARTICIPATION",
  "BEHAVIOR",
  "LEARNING",
  "OTHER",
]);
export const pedagogicalListSchema = z
  .object({
    search: z.string().trim().max(MAX_SEARCH_LENGTH).default(""),
    studentId: id.optional(),
    page: z.number().int().min(1).default(1),
  })
  .strict();
export const occurrenceCreateSchema = z
  .object({
    studentId: id,
    classSessionId: id.optional(),
    occurredOn: civilDateSchema.optional(),
    occurredTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido (HH:mm).")
      .optional(),
    category: occurrenceCategorySchema,
    title,
    account: body,
    initialResponse: z.string().trim().max(MAX_ACCOUNT_LENGTH).default(""),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.classSessionId) {
      if (input.occurredOn || input.occurredTime)
        ctx.addIssue({
          code: "custom",
          path: ["classSessionId"],
          message: "Escolha uma aula ou um horário fora de aula.",
        });
    } else {
      if (!input.occurredOn)
        ctx.addIssue({ code: "custom", path: ["occurredOn"], message: "Informe a data." });
      if (!input.occurredTime)
        ctx.addIssue({ code: "custom", path: ["occurredTime"], message: "Informe o horário." });
    }
  });
export const occurrenceLinkSchema = z.object({ occurrenceId: id, relatedId: id }).strict();
export const occurrenceUpdateSchema = z
  .object({ id, account: body, expectedUpdatedAt: z.date() })
  .strict();
const occurrenceIds = z
  .array(id)
  .max(MAX_LINKED_OCCURRENCES)
  .refine((ids) => new Set(ids).size === ids.length, "Selecione ocorrências distintas.");
export const interventionCreateSchema = z
  .object({
    studentId: id.optional(),
    occurrenceIds: occurrenceIds.default([]),
    responsibleId: id,
    performedOn: civilDateSchema,
    title,
    treatment: body,
  })
  .strict();
export const interventionFollowUpSchema = z
  .object({ id, version: z.number().int().min(0), body })
  .strict();
export const interventionLinkSchema = z
  .object({ id, version: z.number().int().min(0), occurrenceId: id })
  .strict();
export type PedagogicalList = z.infer<typeof pedagogicalListSchema>;
export type OccurrenceCreate = z.infer<typeof occurrenceCreateSchema>;
export type InterventionCreate = z.infer<typeof interventionCreateSchema>;
export type InterventionFollowUp = z.infer<typeof interventionFollowUpSchema>;

export const occurrenceStatusSchema = z.enum(["OPEN", "FOLLOWING_UP", "CLOSED"]);
export const occurrenceStatusChangeSchema = z
  .object({
    id,
    expectedVersion: z.number().int().min(0),
    status: occurrenceStatusSchema,
    conclusion: z.string().trim().max(MAX_ACCOUNT_LENGTH).default(""),
  })
  .strict()
  .refine(
    (input) => input.status !== "CLOSED" || input.conclusion.length >= MIN_DESCRIPTION_LENGTH,
    { path: ["conclusion"], message: "Registre uma breve conclusão para encerrar a ocorrência." },
  );
export type OccurrenceStatusChange = z.infer<typeof occurrenceStatusChangeSchema>;
