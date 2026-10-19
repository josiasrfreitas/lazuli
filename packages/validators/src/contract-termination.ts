import { z } from "zod";
import { civilDateSchema } from "./civil-date.js";

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
      .max(100)
      .refine(
        (value) => Number(value.toFixed(4)) === value,
        "Use no máximo quatro casas decimais na multa.",
      ),
    retainedChargesCents: z.number().int().nonnegative(),
    dueDate: civilDateSchema,
    enrollmentIds: z.array(z.string().uuid()).max(20),
    reason: z
      .string()
      .trim()
      .min(5, "Explique o motivo da rescisão e as condições negociadas.")
      .max(2000),
    acknowledged: z.literal(true),
  })
  .strict();
export type ContractTerminationConfirm = z.infer<typeof contractTerminationConfirmSchema>;
