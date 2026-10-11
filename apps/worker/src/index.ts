import {
  processDueEnrollmentActions,
  processSessionGeneration,
  type SessionGenerationResult,
} from "@lazuli/worker-handlers";
import { SESSIONS_GENERATE_WORKFLOW, type SessionsGeneratePayload } from "@lazuli/job-contracts";
import { getHatchetClient } from "@lazuli/integrations/hatchet";
import { db } from "@lazuli/db";

const ENROLLMENT_POLL_MS = 60_000;
let applyingEnrollmentActions = false;
function log(message: string): void {
  process.stdout.write(`[worker] ${message}\n`);
}
async function processEnrollmentActions(): Promise<void> {
  if (applyingEnrollmentActions) return;
  applyingEnrollmentActions = true;
  try {
    const applied = await db.$transaction((database) =>
      processDueEnrollmentActions({ database, now: new Date() }),
    );
    if (applied > 0) log(`applied ${applied} scheduled enrollment actions`);
  } catch {
    log("scheduled enrollment processing failed");
  } finally {
    applyingEnrollmentActions = false;
  }
}

async function start(): Promise<void> {
  const hatchet = await getHatchetClient();
  const sessions = hatchet.task<SessionsGeneratePayload, SessionGenerationResult>({
    name: SESSIONS_GENERATE_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) => processSessionGeneration({ database: db, payload }),
  });
  const worker = await hatchet.worker("school", {
    slots: 1,
    durableSlots: 1,
    workflows: [sessions],
    handleKill: false,
  });
  const enrollmentTimer = setInterval(() => void processEnrollmentActions(), ENROLLMENT_POLL_MS);
  void processEnrollmentActions();
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(enrollmentTimer);
    await worker.stop();
    await db.$disconnect();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  log("starting sessions-generate worker (1 slot)");
  try {
    await worker.start();
  } finally {
    clearInterval(enrollmentTimer);
  }
}

void start().catch(() => {
  log("startup failed; check Hatchet connection and credentials");
  process.exitCode = 1;
});
