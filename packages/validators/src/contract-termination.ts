import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";

const MAX_FEE_PERCENT = 100;
const FEE_DECIMAL_PLACES = 4;
const MAX_ENROLLMENTS = 20;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 2000;

export const DEFAULT_TERMINATION_FEE_PCT = 20;
export const contractTerminationPreviewSchema = z
  .object({ contractId: z.string().uuid() })
  .strict();
export const contractTerminationConfirmSchema = z
  .object({
    contractId: z.string().uuid(),
    commandId: z.string().uuid(),
    version: z.string().min(1),
    feePct: z
      .number()
      .min(0)
      .max(MAX_FEE_PERCENT)
      .refine(
        (value) => Number(value.toFixed(FEE_DECIMAL_PLACES)) === value,
        "Use no máximo quatro casas decimais na multa.",
      ),
    retainedChargesCents: z.number().int().nonnegative(),
    dueDate: civilDateSchema,
    enrollmentIds: z.array(z.string().uuid()).max(MAX_ENROLLMENTS),
    reason: z
      .string()
      .trim()
      .min(MIN_REASON_LENGTH, "Explique o motivo da rescisão e as condições negociadas.")
      .max(MAX_REASON_LENGTH),
    acknowledged: z.literal(true),
  })
  .strict();
export type ContractTerminationConfirm = z.infer<typeof contractTerminationConfirmSchema>;
