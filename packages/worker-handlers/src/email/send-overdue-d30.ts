/**
 * @implements GRE-51 — replace with D+30 payer email delivery and installment idempotency stamp.
 */

import type { EmailOverdueD30Payload } from "@lazuli/job-contracts";
import { emailOverdueD30PayloadSchema } from "@lazuli/job-contracts";

export type SendOverdueD30Result = {
  installmentId: string;
};

export async function sendOverdueD30(input: {
  payload: EmailOverdueD30Payload;
}): Promise<SendOverdueD30Result> {
  const payload = emailOverdueD30PayloadSchema.parse(input.payload);
  process.stdout.write(`[worker-handlers] email-overdue-d30 installmentId=${payload.installmentId}\n`);
  return { installmentId: payload.installmentId };
}
