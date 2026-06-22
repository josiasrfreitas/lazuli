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

const KEEP_ALIVE_INTERVAL_MILLISECONDS = Number("1073741824");

function start(): void {
  log(`booting — handlers=${WORKER_HANDLERS_PACKAGE} contracts=${JOB_CONTRACTS_PACKAGE}`);
  log("ready (no workflows registered yet)");

  const keepAliveTimer = setInterval(() => true, KEEP_ALIVE_INTERVAL_MILLISECONDS);
  const shutdown = (signal: string): void => {
    log(`received ${signal}, shutting down`);
    clearInterval(keepAliveTimer);
    process.exitCode = 0;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
