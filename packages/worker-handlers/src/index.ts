/**
 * Worker-only handlers for Portal (Playwright), PDFs, GCS, Resend (§2.1).
 * NEVER imported by `apps/web` or `@lazuli/api` — only `apps/worker` consumes this.
 */

export const WORKER_HANDLERS_PACKAGE = "@lazuli/worker-handlers" as const;
export {
  generateClassSessions,
  planClassSessionRows,
  type SessionGenerationResult,
} from "./sessions/generate.js";
export { processSessionGeneration } from "./sessions/process-generation.js";
export { processDueEnrollmentActions } from "./enrollment/process-due-actions.js";
export { processReportGenerate } from "./reports/process-report-generate.js";
export type { ProcessReportGenerateResult } from "./reports/process-report-generate.js";
export { sendOverdueD30 } from "./email/send-overdue-d30.js";
export type { SendOverdueD30Result } from "./email/send-overdue-d30.js";
export { sendOverdueDigest } from "./email/send-overdue-digest.js";
export { sendPortalFailureEmail } from "./email/send-portal-failure-email.js";
export type { SendPortalFailureEmailResult } from "./email/send-portal-failure-email.js";
