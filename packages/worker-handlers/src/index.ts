/**
 * Worker-only handlers for Portal (Playwright), PDFs, GCS, Resend (§2.1).
 * NEVER imported by `apps/web` or `@lazuli/api` — only `apps/worker` consumes this.
 */

export const WORKER_HANDLERS_PACKAGE = "@lazuli/worker-handlers" as const;
