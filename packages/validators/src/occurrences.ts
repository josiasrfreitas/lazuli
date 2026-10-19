import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
const id = z.string().uuid("Selecione uma opção válida.");
const body = z.string().trim().min(3, "Descreva o contexto com mais detalhes.").max(5000);
const title = z.string().trim().min(3, "Informe um título.").max(160);
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
    search: z.string().trim().max(160).default(""),
    studentId: id.optional(),
    page: z.number().int().min(1).default(1),
  })
  .strict();
export const occurrenceCreateSchema = z
  .object({
    studentId: id,
    classSessionId: id,
    category: occurrenceCategorySchema,
    title,
    account: body,
    initialResponse: z.string().trim().max(5000).default(""),
  })
  .strict();
export const occurrenceLinkSchema = z.object({ occurrenceId: id, relatedId: id }).strict();
export const occurrenceUpdateSchema = z
  .object({ id, account: body, expectedUpdatedAt: z.date() })
  .strict();
const occurrenceIds = z
  .array(id)
  .max(50)
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
