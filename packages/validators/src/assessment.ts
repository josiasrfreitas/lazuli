import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";
const MAX_SCORE = 100;
const DECIMAL_STEP = 0.1;
const MAX_GRADES = 12;
const MAX_REASON = 2000;
export const assessmentObservationsSchema = z
  .array(
    z
      .object({
        phase: z.enum(["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"]),
        competence: z.enum(["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"]),
        notes: z.string().trim().min(1).max(MAX_REASON),
      })
      .strict(),
  )
  .max(MAX_GRADES);
const grade = z
  .object({
    phase: z.enum(["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"]),
    competence: z.enum(["ORAL", "LISTENING", "WRITTEN", "PARTICIPATION"]),
    score: z
      .number({ invalid_type_error: "Informe uma nota válida." })
      .min(0, "Use uma nota entre 0 e 100.")
      .max(MAX_SCORE, "Use uma nota entre 0 e 100.")
      .multipleOf(DECIMAL_STEP, "Use no máximo uma casa decimal.")
      .nullable(),
    assessedOn: civilDateSchema.nullable(),
    reason: z.string().trim().max(MAX_REASON).nullable(),
    notes: z.string().trim().max(MAX_REASON).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.score !== null && !value.assessedOn)
      context.addIssue({
        code: "custom",
        path: ["assessedOn"],
        message: "Informe a data da avaliação.",
      });
    if (value.phase === "RECOVERY" && value.score !== null && !value.reason)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Descreva a recuperação realizada.",
      });
  });
export const assessmentProgressSchema = z.object({ progressId: z.string().uuid() }).strict();
export const assessmentSaveSchema = assessmentProgressSchema
  .extend({
    version: z.number().int().nonnegative(),
    correctionReason: z.string().trim().max(MAX_REASON).optional(),
    grades: z.array(grade).min(1).max(MAX_GRADES),
  })
  .superRefine((value, context) => {
    const keys = value.grades.map((item) => `${item.phase}/${item.competence}`);
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: "custom",
        path: ["grades"],
        message: "Competência repetida na mesma unidade.",
      });
  });
export const assessmentConfirmSchema = assessmentProgressSchema.extend({
  version: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REPEAT"]),
  reason: z.string().trim().min(1, "Informe a justificativa pedagógica.").max(MAX_REASON),
});
export type AssessmentSave = z.infer<typeof assessmentSaveSchema>;
export type AssessmentConfirm = z.infer<typeof assessmentConfirmSchema>;
