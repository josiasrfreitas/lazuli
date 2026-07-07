import { z } from "zod";

const INVALID_ENROLLMENT_ID_MESSAGE = "Identificador de matricula invalido.";
const INVALID_SESSION_ID_MESSAGE = "Identificador de sessao invalido.";
const INVALID_MAKEUP_ID_MESSAGE = "Identificador de reposicao invalido.";
const CANCEL_REASON_EMPTY_MESSAGE = "Motivo do cancelamento nao pode ser vazio.";

const makeupIdSchema = z.string().uuid(INVALID_MAKEUP_ID_MESSAGE);
const optionalReasonSchema = z.string().trim().min(1).optional();

/**
 * Input for `attendance.scheduleMakeup` (S-ATT-3). `reason` doubles as the admin override recorded
 * when the target class equals the origin class (§4.6); the same-class and advance-date rules
 * depend on server state, so they are enforced in the service layer, not here.
 */
export const makeupScheduleInputSchema = z
  .object({
    originEnrollmentId: z.string().uuid(INVALID_ENROLLMENT_ID_MESSAGE),
    targetClassSessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
    reason: optionalReasonSchema,
  })
  .strict();

/** Input for `attendance.cancelMakeup` (S-ATT-3 support). Cancellation reason is required. */
export const makeupCancelInputSchema = z
  .object({
    makeupId: makeupIdSchema,
    reason: z.string().trim().min(1, CANCEL_REASON_EMPTY_MESSAGE),
  })
  .strict();

/**
 * Input for `attendance.markMakeupOutcome` (S-ATT-2). `attended: true` stamps the visitor as
 * attended; `false` clears it so the outcome derives to NO_SHOW after the target session end.
 */
export const makeupOutcomeInputSchema = z
  .object({
    makeupId: makeupIdSchema,
    attended: z.boolean(),
  })
  .strict();
