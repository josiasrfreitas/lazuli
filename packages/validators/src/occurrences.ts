import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
const id = z.string().uuid();
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
    status: z.enum(["ALL", "OPEN", "IN_PROGRESS", "CONCLUDED", "OVERDUE"]).default("ALL"),
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
export const occurrenceNoteSchema = z.object({ id, body }).strict();
const occurrenceIds = z
  .array(id)
  .min(2, "Selecione pelo menos duas ocorrências.")
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "Selecione ocorrências distintas.");
export const interventionCreateSchema = z
  .object({
    occurrenceIds,
    teacherId: id,
    title,
    objective: body,
    nextStep: body,
    dueOn: civilDateSchema.nullable().default(null),
  })
  .strict();
export const interventionUpdateSchema = z
  .object({
    id,
    version: z.number().int().min(0),
    kind: z.enum(["NOTE", "START", "CONCLUDE", "REOPEN", "ASSIGN"]),
    body,
    nextStep: body.optional(),
    dueOn: civilDateSchema.nullable().optional(),
    teacherId: id.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.kind === "ASSIGN") !== Boolean(value.teacherId))
      context.addIssue({
        code: "custom",
        path: ["teacherId"],
        message: "Informe o professor somente ao alterar o responsável.",
      });
  });
export const interventionLinkSchema = z
  .object({ id, version: z.number().int().min(0), occurrenceId: id })
  .strict();
export type PedagogicalList = z.infer<typeof pedagogicalListSchema>;
export type OccurrenceCreate = z.infer<typeof occurrenceCreateSchema>;
export type InterventionCreate = z.infer<typeof interventionCreateSchema>;
export type InterventionUpdate = z.infer<typeof interventionUpdateSchema>;
