import { z } from "zod";

import { dateOnlyInputSchema } from "./student.js";

const CAPACITY_OVERRIDE_REASON_EMPTY_MESSAGE =
  "Motivo de excecao de capacidade nao pode ser vazio.";
const INVALID_ENROLLMENT_ID_MESSAGE = "Identificador de matricula invalido.";
const INVALID_CLASS_ID_MESSAGE = "Identificador de turma invalido.";

const enrollmentIdSchema = z.string().uuid(INVALID_ENROLLMENT_ID_MESSAGE);
const capacityOverrideReasonSchema = z
  .string()
  .trim()
  .min(1, CAPACITY_OVERRIDE_REASON_EMPTY_MESSAGE);

/**
 * Input for `enrollment.create` (S-ENR-1). The REGULAR/PERSONALIZED rule for `stageId`
 * depends on the target class `scheduleType`, which is not part of this input, so it is
 * enforced in the service layer rather than here.
 */
export const enrollmentCreateInputSchema = z
  .object({
    studentId: z.string().uuid("Identificador de aluno invalido."),
    classId: z.string().uuid(INVALID_CLASS_ID_MESSAGE),
    entryDate: dateOnlyInputSchema.optional(),
    stageId: z.string().uuid("Identificador de etapa invalido.").optional(),
    capacityOverrideReason: capacityOverrideReasonSchema.optional(),
  })
  .strict();

/**
 * Input for `enrollment.advanceStage` (S-ENR-4). Advancing a PERSONALIZED/PPT student moves
 * their active `PedagogicalProgress` to the next `Stage` in the same `Track`; the schedule-type
 * and end-of-track rules depend on server state, so they are enforced in the service layer.
 */
export const enrollmentAdvanceStageInputSchema = z
  .object({
    enrollmentId: enrollmentIdSchema,
  })
  .strict();

/**
 * Input for `enrollment.transfer` (S-ENR-2). Moves a student from their current enrollment to
 * another class, carrying progress. The target stage is derived server-side (REGULAR copies the
 * target class stage; PERSONALIZED carries the student's current stage forward), so it is not part
 * of this input.
 */
export const enrollmentTransferInputSchema = z
  .object({
    enrollmentId: enrollmentIdSchema,
    targetClassId: z.string().uuid(INVALID_CLASS_ID_MESSAGE),
    entryDate: dateOnlyInputSchema.optional(),
    capacityOverrideReason: capacityOverrideReasonSchema.optional(),
  })
  .strict();

/**
 * Input for `enrollment.close` (S-ENR-3). Drops (`DROPPED`) or pauses (`SUSPENDED`) a single
 * enrollment. Academic close makes no automatic billing change (spec §5.3 resolved assumption);
 * staff use manual finance tools.
 */
export const enrollmentCloseInputSchema = z
  .object({
    enrollmentId: enrollmentIdSchema,
    reason: z.enum(["DROPPED", "SUSPENDED"]),
  })
  .strict();
