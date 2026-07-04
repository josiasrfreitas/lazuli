/**
 * Hatchet workflow names, payload schemas, and enqueue helpers (§2.1).
 *
 * Owns enqueue contracts ONLY. Must never import worker handlers — this is
 * what keeps Playwright/PDF/GCS/email deps out of the web app (§2.1 rule).
 */

import { z } from "@lazuli/validators";

export const JOB_CONTRACTS_PACKAGE = "@lazuli/job-contracts" as const;

const SCOPE_MESSAGE = "Informe classId ou semesterId, nunca ambos.";

export const SESSIONS_GENERATE_WORKFLOW = "sessions-generate" as const;

export const sessionsGeneratePayloadSchema = z
  .object({
    classId: z.string().uuid().optional(),
    semesterId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((payload, context) => {
    if ((payload.classId === undefined) === (payload.semesterId === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: SCOPE_MESSAGE });
    }
  });

export type SessionsGeneratePayload = z.infer<typeof sessionsGeneratePayloadSchema>;

export type EnqueueSessionsGenerateResult = {
  workflowName: typeof SESSIONS_GENERATE_WORKFLOW;
  jobId: string;
  payload: SessionsGeneratePayload;
};

export type SessionsGenerateQueue = {
  enqueueSessionsGenerate(payload: SessionsGeneratePayload): Promise<EnqueueSessionsGenerateResult>;
};

export async function enqueueSessionsGenerate(input: {
  queue: SessionsGenerateQueue;
  payload: SessionsGeneratePayload;
}): Promise<EnqueueSessionsGenerateResult> {
  const payload = sessionsGeneratePayloadSchema.parse(input.payload);
  return input.queue.enqueueSessionsGenerate(payload);
}

export function createLocalSessionsGenerateQueue(): SessionsGenerateQueue {
  return {
    enqueueSessionsGenerate: (payload) =>
      Promise.resolve({
        workflowName: SESSIONS_GENERATE_WORKFLOW,
        jobId: buildLocalJobId(payload),
        payload,
      }),
  };
}

function buildLocalJobId(payload: SessionsGeneratePayload): string {
  const id = payload.classId ?? payload.semesterId ?? "invalid";
  return `${SESSIONS_GENERATE_WORKFLOW}:${id}`;
}
