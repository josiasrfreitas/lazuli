import { z } from "zod";

import { dateOnlyInputSchema } from "./student.js";

const CAPACITY_OVERRIDE_REASON_EMPTY_MESSAGE =
  "Motivo de excecao de capacidade nao pode ser vazio.";

/**
 * Input for `enrollment.create` (S-ENR-1). The REGULAR/PERSONALIZED rule for `stageId`
 * depends on the target class `scheduleType`, which is not part of this input, so it is
 * enforced in the service layer rather than here.
 */
export const enrollmentCreateInputSchema = z
  .object({
    studentId: z.string().uuid("Identificador de aluno invalido."),
    classId: z.string().uuid("Identificador de turma invalido."),
    entryDate: dateOnlyInputSchema.optional(),
    stageId: z.string().uuid("Identificador de etapa invalido.").optional(),
    capacityOverrideReason: z
      .string()
      .trim()
      .min(1, CAPACITY_OVERRIDE_REASON_EMPTY_MESSAGE)
      .optional(),
  })
  .strict();
