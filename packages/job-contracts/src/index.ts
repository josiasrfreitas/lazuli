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
        jobId: buildLocalJobId(
          SESSIONS_GENERATE_WORKFLOW,
          payload.classId ?? payload.semesterId ?? "invalid",
        ),
        payload,
      }),
  };
}

export const REPORT_GENERATE_WORKFLOW = "report-generate" as const;

export const reportGeneratePayloadSchema = z
  .object({
    artifactId: z.string().uuid(),
  })
  .strict();

export type ReportGeneratePayload = z.infer<typeof reportGeneratePayloadSchema>;

export type EnqueueReportGenerateResult = {
  workflowName: typeof REPORT_GENERATE_WORKFLOW;
  jobId: string;
  payload: ReportGeneratePayload;
};

export type ReportGenerateQueue = {
  enqueueReportGenerate(payload: ReportGeneratePayload): Promise<EnqueueReportGenerateResult>;
};

export async function enqueueReportGenerate(input: {
  queue: ReportGenerateQueue;
  payload: ReportGeneratePayload;
}): Promise<EnqueueReportGenerateResult> {
  const payload = reportGeneratePayloadSchema.parse(input.payload);
  return input.queue.enqueueReportGenerate(payload);
}

export function createLocalReportGenerateQueue(): ReportGenerateQueue {
  return {
    enqueueReportGenerate: (payload) =>
      Promise.resolve({
        workflowName: REPORT_GENERATE_WORKFLOW,
        jobId: buildLocalJobId(REPORT_GENERATE_WORKFLOW, payload.artifactId),
        payload,
      }),
  };
}

export const EMAIL_PORTAL_FAILURE_WORKFLOW = "email-portal-failure" as const;

export const emailPortalFailurePayloadSchema = z
  .object({
    portalRunId: z.string().uuid(),
  })
  .strict();

export type EmailPortalFailurePayload = z.infer<typeof emailPortalFailurePayloadSchema>;

export type EnqueueEmailPortalFailureResult = {
  workflowName: typeof EMAIL_PORTAL_FAILURE_WORKFLOW;
  jobId: string;
  payload: EmailPortalFailurePayload;
};

export type EmailPortalFailureQueue = {
  enqueueEmailPortalFailure(
    payload: EmailPortalFailurePayload,
  ): Promise<EnqueueEmailPortalFailureResult>;
};

export async function enqueueEmailPortalFailure(input: {
  queue: EmailPortalFailureQueue;
  payload: EmailPortalFailurePayload;
}): Promise<EnqueueEmailPortalFailureResult> {
  const payload = emailPortalFailurePayloadSchema.parse(input.payload);
  return input.queue.enqueueEmailPortalFailure(payload);
}

export function createLocalEmailPortalFailureQueue(): EmailPortalFailureQueue {
  return {
    enqueueEmailPortalFailure: (payload) =>
      Promise.resolve({
        workflowName: EMAIL_PORTAL_FAILURE_WORKFLOW,
        jobId: buildLocalJobId(EMAIL_PORTAL_FAILURE_WORKFLOW, payload.portalRunId),
        payload,
      }),
  };
}

export const EMAIL_OVERDUE_DIGEST_WORKFLOW = "email-overdue-digest" as const;

export const emailOverdueDigestPayloadSchema = z.object({}).strict();

export type EmailOverdueDigestPayload = z.infer<typeof emailOverdueDigestPayloadSchema>;

export type EnqueueEmailOverdueDigestResult = {
  workflowName: typeof EMAIL_OVERDUE_DIGEST_WORKFLOW;
  jobId: string;
  payload: EmailOverdueDigestPayload;
};

export type EmailOverdueDigestQueue = {
  enqueueEmailOverdueDigest(
    payload: EmailOverdueDigestPayload,
  ): Promise<EnqueueEmailOverdueDigestResult>;
};

export async function enqueueEmailOverdueDigest(input: {
  queue: EmailOverdueDigestQueue;
  payload: EmailOverdueDigestPayload;
}): Promise<EnqueueEmailOverdueDigestResult> {
  const payload = emailOverdueDigestPayloadSchema.parse(input.payload);
  return input.queue.enqueueEmailOverdueDigest(payload);
}

export function createLocalEmailOverdueDigestQueue(): EmailOverdueDigestQueue {
  return {
    enqueueEmailOverdueDigest: (payload) =>
      Promise.resolve({
        workflowName: EMAIL_OVERDUE_DIGEST_WORKFLOW,
        jobId: buildLocalJobId(EMAIL_OVERDUE_DIGEST_WORKFLOW, "digest"),
        payload,
      }),
  };
}

export const EMAIL_OVERDUE_D30_WORKFLOW = "email-overdue-d30" as const;

export const emailOverdueD30PayloadSchema = z
  .object({
    installmentId: z.string().uuid(),
  })
  .strict();

export type EmailOverdueD30Payload = z.infer<typeof emailOverdueD30PayloadSchema>;

export type EnqueueEmailOverdueD30Result = {
  workflowName: typeof EMAIL_OVERDUE_D30_WORKFLOW;
  jobId: string;
  payload: EmailOverdueD30Payload;
};

export type EmailOverdueD30Queue = {
  enqueueEmailOverdueD30(payload: EmailOverdueD30Payload): Promise<EnqueueEmailOverdueD30Result>;
};

export async function enqueueEmailOverdueD30(input: {
  queue: EmailOverdueD30Queue;
  payload: EmailOverdueD30Payload;
}): Promise<EnqueueEmailOverdueD30Result> {
  const payload = emailOverdueD30PayloadSchema.parse(input.payload);
  return input.queue.enqueueEmailOverdueD30(payload);
}

export function createLocalEmailOverdueD30Queue(): EmailOverdueD30Queue {
  return {
    enqueueEmailOverdueD30: (payload) =>
      Promise.resolve({
        workflowName: EMAIL_OVERDUE_D30_WORKFLOW,
        jobId: buildLocalJobId(EMAIL_OVERDUE_D30_WORKFLOW, payload.installmentId),
        payload,
      }),
  };
}

function buildLocalJobId(workflowName: string, id: string): string {
  return `${workflowName}:${id}`;
}
