/**
 * Hatchet workflow names, payload schemas, and enqueue helpers (§2.1).
 *
 * Owns enqueue contracts ONLY. Must never import worker handlers — this is
 * what keeps Playwright/PDF/GCS/email deps out of the web app (§2.1 rule).
 */

export const JOB_CONTRACTS_PACKAGE = "@lazuli/job-contracts" as const;
