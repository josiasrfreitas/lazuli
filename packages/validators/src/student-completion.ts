import { z } from "zod";
import { createMonthlyContractInputSchema } from "./contracts.js";
import { studentCreateInputSchema } from "./student.js";

const MAX_NOTES_LENGTH = 1200;

export const studentPedagogyIntakeSchema = z
  .object({
    semesterId: z.string().uuid(),
    stageId: z.string().uuid().nullable(),
    planId: z.string().uuid().nullable(),
    notes: z.string().trim().max(MAX_NOTES_LENGTH).default(""),
  })
  .strict();
export type StudentPedagogyIntake = z.infer<typeof studentPedagogyIntakeSchema>;

/** The wizard owns an unpersisted beneficiary, never an existing student selection. */
export const studentCompletionInputSchema = z.union([
  z
    .object({
      commandId: z.string().uuid(),
      student: studentCreateInputSchema,
      pedagogy: studentPedagogyIntakeSchema.optional(),
    })
    .strict(),
  z
    .object({
      contract: createMonthlyContractInputSchema,
      pedagogy: studentPedagogyIntakeSchema.optional(),
    })
    .strict()
    .superRefine((input, context) => {
      if (!input.contract.newStudent) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contract", "newStudent"],
          message: "Informe o rascunho do novo aluno.",
        });
      }
    }),
]);

export type StudentCompletionInput = z.infer<typeof studentCompletionInputSchema>;
