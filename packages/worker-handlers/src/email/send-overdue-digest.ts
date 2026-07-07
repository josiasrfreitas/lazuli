/**
 * @implements GRE-51 — replace with Hatchet cron, idempotency, and overdue digest content.
 */

import type { EmailOverdueDigestPayload } from "@lazuli/job-contracts";
import { emailOverdueDigestPayloadSchema } from "@lazuli/job-contracts";

export function sendOverdueDigest(input: { payload: EmailOverdueDigestPayload }): Promise<void> {
  emailOverdueDigestPayloadSchema.parse(input.payload);
  process.stdout.write("[worker-handlers] email-overdue-digest\n");
  return Promise.resolve();
}
