import { z } from "zod";
import { makeupCoverageSchema } from "./appointments.js";

const INVALID_ENROLLMENT_ID_MESSAGE = "Identificador de matricula invalido.";
const INVALID_SESSION_ID_MESSAGE = "Identificador de sessao invalido.";
const INVALID_MAKEUP_ID_MESSAGE = "Identificador de reposicao invalido.";
const CANCEL_REASON_EMPTY_MESSAGE = "Motivo do cancelamento nao pode ser vazio.";

const makeupIdSchema = z.string().uuid(INVALID_MAKEUP_ID_MESSAGE);
const optionalReasonSchema = z.string().trim().min(1).optional();

/** Compatibility input: verified source allocation follows the same rules as appointments. */
export const makeupScheduleInputSchema = z
  .object({
    originEnrollmentId: z.string().uuid(INVALID_ENROLLMENT_ID_MESSAGE),
    targetClassSessionId: z.string().uuid(INVALID_SESSION_ID_MESSAGE),
    reason: optionalReasonSchema,
    coverages: z.array(makeupCoverageSchema).min(1).max(20),
    plannedContent: z.string().trim().max(4000).default(""),
  })
  .strict();

/** Input for `attendance.cancelMakeup` (S-ATT-3 support). Cancellation reason is required. */
export const makeupCancelInputSchema = z
  .object({
    makeupId: makeupIdSchema,
    expectedVersion: z.number().int().min(0),
    reason: z.string().trim().min(1, CANCEL_REASON_EMPTY_MESSAGE),
  })
  .strict();

/** A versioned outcome requires actual delivery; corrections preserve the previous evidence. */
export const makeupOutcomeInputSchema = z
  .object({
    makeupId: makeupIdSchema,
    attended: z.boolean(),
    expectedVersion: z.number().int().min(0),
    performedContent: z.string().trim().max(4000),
    performedMinutes: z.number().int().min(1).max(1440).nullable(),
    coverages: z.array(makeupCoverageSchema).max(20),
    notes: z.string().trim().max(4000).default(""),
    reason: z.string().trim().max(4000).default(""),
  })
  .strict();
