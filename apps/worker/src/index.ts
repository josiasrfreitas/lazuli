import { WORKER_HANDLERS_PACKAGE } from "@lazuli/worker-handlers";
import { JOB_CONTRACTS_PACKAGE } from "@lazuli/job-contracts";

/**
 * Single Hatchet worker entry (§2.1, §2.2).
 *
 * SCAFFOLD ONLY: real Hatchet registration + handler wiring lands in later
 * projects. For now this boots a long-running process so `pnpm dev:worker`
 * behaves like the eventual Cloud Run service.
 */

function log(message: string): void {
  process.stdout.write(`[worker] ${message}\n`);
}

function start(): void {
  log(`booting — handlers=${WORKER_HANDLERS_PACKAGE} contracts=${JOB_CONTRACTS_PACKAGE}`);
  log("ready (no workflows registered yet)");

  const shutdown = (signal: string): void => {
    log(`received ${signal}, shutting down`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep the process alive until a signal arrives.
  setInterval(() => undefined, 1 << 30);
}

start();
