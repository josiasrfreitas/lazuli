/**
 * @implements GRE-50 — replace with Resend/Mailpit delivery wired from portal-submit failures.
 */

import type { EmailPortalFailurePayload } from "@lazuli/job-contracts";
import { emailPortalFailurePayloadSchema } from "@lazuli/job-contracts";

export type SendPortalFailureEmailResult = {
  portalRunId: string;
};

export function sendPortalFailureEmail(input: {
  payload: EmailPortalFailurePayload;
}): Promise<SendPortalFailureEmailResult> {
  const payload = emailPortalFailurePayloadSchema.parse(input.payload);
  process.stdout.write(
    `[worker-handlers] email-portal-failure portalRunId=${payload.portalRunId}\n`,
  );
  return Promise.resolve({ portalRunId: payload.portalRunId });
}
