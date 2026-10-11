import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
const MAX_TEXT = 2000;
const MAX_TITLE = 160;
const MAX_REFERENCE = 200;
const MAX_PAGE = 10000;
export const stagePlanTargetSchema = z
  .object({
    classId: z.string().uuid(),
    progressId: z.string().uuid().optional(),
  })
  .strict();
export const stagePlanKindSchema = z.enum(["CONTENT", "REVIEW", "ASSESSMENT", "ACTIVITY"]);
const reason = z.string().trim().min(3, "Explique o motivo da revisão.").max(MAX_TEXT);
const windowFields = {
  plannedStartOn: civilDateSchema,
  plannedEndOn: civilDateSchema,
  objective: z.string().trim().max(MAX_TEXT).nullable(),
};
const itemFields = {
  plannedOn: civilDateSchema,
  kind: stagePlanKindSchema,
  title: z.string().trim().min(3, "Descreva a atividade planejada.").max(MAX_TITLE),
  reference: z.string().trim().max(MAX_REFERENCE).nullable(),
  pageFrom: z.number().int().min(1).max(MAX_PAGE).nullable(),
  pageTo: z.number().int().min(1).max(MAX_PAGE).nullable(),
};
export const stagePlanWindowSchema = stagePlanTargetSchema
  .extend({
    ...windowFields,
    version: z.number().int().nonnegative(),
    reason: reason.optional(),
  })
  .superRefine((value, context) => {
    if (value.plannedEndOn < value.plannedStartOn)
      context.addIssue({
        code: "custom",
        path: ["plannedEndOn"],
        message: "O prazo deve ser igual ou posterior ao início.",
      });
    if (value.version > 0 && !value.reason)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explique o motivo da revisão.",
      });
  });
export const stagePlanItemSchema = stagePlanTargetSchema
  .extend({
    ...itemFields,
    version: z.number().int().positive(),
    itemId: z.string().uuid().optional(),
    reason: reason.optional(),
  })
  .superRefine((value, context) => {
    if (value.pageTo !== null && (value.pageFrom === null || value.pageTo < value.pageFrom))
      context.addIssue({
        code: "custom",
        path: ["pageTo"],
        message: "Informe um intervalo de páginas válido.",
      });
    if (value.itemId && !value.reason)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explique o motivo da revisão.",
      });
  });
export const stagePlanRemoveSchema = stagePlanTargetSchema.extend({
  itemId: z.string().uuid(),
  version: z.number().int().positive(),
  reason,
});
export const stagePlanSnapshotSchema = z.object({
  ...windowFields,
  items: z.array(z.object({ id: z.string().uuid(), ...itemFields })),
});
export type StagePlanTarget = z.infer<typeof stagePlanTargetSchema>;
export type StagePlanWindow = z.infer<typeof stagePlanWindowSchema>;
export type StagePlanItemInput = z.infer<typeof stagePlanItemSchema>;
export type StagePlanRemove = z.infer<typeof stagePlanRemoveSchema>;
