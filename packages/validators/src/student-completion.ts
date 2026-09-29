import { z } from "zod";
import { createMonthlyContractInputSchema } from "./contracts.js";
import { studentCreateInputSchema } from "./student.js";

/** The wizard owns an unpersisted beneficiary, never an existing student selection. */
export const studentCompletionInputSchema = z.union([
  z.object({ commandId: z.string().uuid(), student: studentCreateInputSchema }).strict(),
  z
    .object({ contract: createMonthlyContractInputSchema })
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
