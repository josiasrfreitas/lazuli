import { processAssessmentFile } from "@lazuli/worker-handlers/assessment-files";
import { startAssessmentRecovery } from "./assessment-recovery.js";
import { processDueEnrollmentActions } from "@lazuli/worker-handlers";
import { processSessionGeneration } from "@lazuli/worker-handlers/sessions";
import {
  ASSESSMENT_FILE_WORKFLOW,
  type AssessmentFilePayload,
  SESSIONS_GENERATE_WORKFLOW,
  type SessionsGeneratePayload,
} from "@lazuli/job-contracts";
import { getHatchetClient } from "@lazuli/integrations/hatchet";
import { db } from "@lazuli/db";
import { runWithReadiness } from "./readiness.js";

type GenerationResult = Awaited<ReturnType<typeof processSessionGeneration>>;
const ENROLLMENT_POLL_MS = 60_000;
const TRANSACTION_TIMEOUT_MS = 30_000;
let applyingEnrollmentActions = false;
function log(message: string): void {
  process.stdout.write(`[worker] ${message}\n`);
}
async function processEnrollmentActions(): Promise<void> {
  if (applyingEnrollmentActions) return;
  applyingEnrollmentActions = true;
  try {
    const applied = await db.$transaction(
      (database) => processDueEnrollmentActions({ database, now: new Date() }),
      { timeout: TRANSACTION_TIMEOUT_MS },
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
  const sessions = hatchet.task<SessionsGeneratePayload, GenerationResult>({
    name: SESSIONS_GENERATE_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) => processSessionGeneration({ database: db, payload }),
  });
  const files = hatchet.task<AssessmentFilePayload, { status: string }>({
    name: ASSESSMENT_FILE_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) => processAssessmentFile({ database: db, payload }),
  });
  const worker = await hatchet.worker("school", {
    slots: 1,
    durableSlots: 1,
    workflows: [sessions, files],
    handleKill: false,
  });
  const timer = setInterval(() => void processEnrollmentActions(), ENROLLMENT_POLL_MS);
  const stopRecovery = startAssessmentRecovery();
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    stopRecovery();
    void worker.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  void processEnrollmentActions();
  log("starting sessions-generate worker (1 slot)");
  try {
    await runWithReadiness(worker);
  } finally {
    clearInterval(timer);
    stopRecovery();
    await db.$disconnect();
  }
}
try {
  await start();
} catch {
  log("startup failed; check Hatchet connection and credentials");
  process.exitCode = 1;
}
