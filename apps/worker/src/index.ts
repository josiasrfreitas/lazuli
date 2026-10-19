import { processAssessmentFile, recoverAssessmentFiles } from "@lazuli/worker-handlers/assessment-files";
import { processDueEnrollmentActions } from "@lazuli/worker-handlers/enrollment";
import { processSessionGeneration } from "@lazuli/worker-handlers/sessions";
type SessionGenerationResult = Awaited<ReturnType<typeof processSessionGeneration>>;
import { ASSESSMENT_FILE_WORKFLOW, type AssessmentFilePayload, SESSIONS_GENERATE_WORKFLOW, type SessionsGeneratePayload } from "@lazuli/job-contracts";
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
    const applied = await db.$transaction(
      (database) => processDueEnrollmentActions({ database, now: new Date() }),
      { timeout: 30_000 },
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
  const files = hatchet.task<AssessmentFilePayload, { status: string }>({ name: ASSESSMENT_FILE_WORKFLOW, retries: 0, executionTimeout: "2m", scheduleTimeout: "5m", fn: (payload) => processAssessmentFile({ database: db, payload }) });
  const worker = await hatchet.worker("school", {
    slots: 1,
    durableSlots: 1,
    workflows: [sessions, files],
    handleKill: false,
  });
  const enrollmentTimer = setInterval(() => void processEnrollmentActions(), ENROLLMENT_POLL_MS);
  let recoveringFiles = false;
  const recover = async () => {
    if (recoveringFiles) return;
    recoveringFiles = true;
    try { await recoverAssessmentFiles(db); } catch { log("assessment file recovery failed"); } finally { recoveringFiles = false; }
  };
  const fileTimer = setInterval(() => void recover(), 15_000);
  void recover();
  void processEnrollmentActions();
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(enrollmentTimer);
    clearInterval(fileTimer);
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
    clearInterval(fileTimer);
  }
}

void start().catch(() => {
  log("startup failed; check Hatchet connection and credentials");
  process.exitCode = 1;
});
