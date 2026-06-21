/**
 * tRPC routers, procedures, RBAC middleware, service orchestration (§2.1, §5).
 * The BFF boundary: all web writes go through these procedures.
 *
 * Note: must NOT import `@lazuli/worker-handlers` (Playwright/PDF/GCS/email) —
 * heavy work is enqueued via `@lazuli/job-contracts` only.
 */

export const API_PACKAGE = "@lazuli/api" as const;
