import { WORKER_HANDLERS_PACKAGE, processDueEnrollmentActions } from "@lazuli/worker-handlers";
import { JOB_CONTRACTS_PACKAGE } from "@lazuli/job-contracts";
import { db } from "@lazuli/db";

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
const ENROLLMENT_POLL_INTERVAL_MILLISECONDS = 60_000;

async function processEnrollmentActions(): Promise<void> {
  try {
    const applied = await db.$transaction((database) =>
      processDueEnrollmentActions({ database, now: new Date() }),
    );
    if (applied > 0) log(`applied ${applied} scheduled enrollment actions`);
  } catch (error) {
    log(
      `scheduled enrollment processing failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
  }
}

function start(): void {
  log(`booting — handlers=${WORKER_HANDLERS_PACKAGE} contracts=${JOB_CONTRACTS_PACKAGE}`);
  log("ready (no workflows registered yet)");

  const keepAliveTimer = setInterval(() => true, KEEP_ALIVE_INTERVAL_MILLISECONDS);
  const enrollmentTimer = setInterval(
    () => void processEnrollmentActions(),
    ENROLLMENT_POLL_INTERVAL_MILLISECONDS,
  );
  void processEnrollmentActions();
  const shutdown = (signal: string): void => {
    log(`received ${signal}, shutting down`);
    clearInterval(keepAliveTimer);
    clearInterval(enrollmentTimer);
    process.exitCode = 0;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
