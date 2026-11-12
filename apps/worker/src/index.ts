import { startCalendarReconciliation } from "./calendar-reconciliation.js";
import { startStudentHealthRefresh } from "./student-health.js";
import { processAssessmentFile } from "@lazuli/worker-handlers/assessment-files";
import { processStudentDocument } from "@lazuli/worker-handlers/student-documents";
import { startAssessmentRecovery } from "./assessment-recovery.js";
import { processDueEnrollmentActions } from "@lazuli/worker-handlers";
import { processSessionGeneration } from "@lazuli/worker-handlers/sessions";
import {
  ASSESSMENT_FILE_WORKFLOW,
  type AssessmentFilePayload,
  STUDENT_DOCUMENT_WORKFLOW,
  studentDocumentPayloadSchema,
  type StudentDocumentPayload,
  SESSIONS_GENERATE_WORKFLOW,
  type SessionsGeneratePayload,
} from "@lazuli/job-contracts";
import { getHatchetClient } from "@lazuli/integrations/hatchet";
import { db } from "@lazuli/db";
import { runWithReadiness } from "./readiness.js";
import { randomUUID } from "node:crypto";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

type GenerationResult = Awaited<ReturnType<typeof processSessionGeneration>>;
const ENROLLMENT_POLL_MS = 60_000;
const TRANSACTION_TIMEOUT_MS = 30_000;
let applyingEnrollmentActions = false;

async function runJob<Result>(jobName: string, action: () => Promise<Result>): Promise<Result> {
  const jobLogger = logger.child({ job_id: randomUUID(), job_name: jobName });
  const started = performance.now();
  jobLogger.info("Worker job started");
  try {
    const result = await action();
    jobLogger.info(
      { duration_ms: Math.round(performance.now() - started) },
      "Worker job completed",
    );
    return result;
  } catch (error) {
    jobLogger.error(
      { duration_ms: Math.round(performance.now() - started), ...safeError(error) },
      "Worker job failed",
    );
    throw error;
  }
}
async function processEnrollmentActions(): Promise<void> {
  if (applyingEnrollmentActions) return;
  applyingEnrollmentActions = true;
  try {
    const applied = await db.$transaction(
      (database) => processDueEnrollmentActions({ database, now: new Date() }),
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
    if (applied > 0)
      logger.info({ applied_count: applied }, "Scheduled enrollment actions applied");
  } catch (error) {
    logger.error(safeError(error), "Scheduled enrollment processing failed");
  } finally {
    applyingEnrollmentActions = false;
  }
}
async function start(): Promise<void> {
  const hatchet = await getHatchetClient();
  const worker = await createWorker(hatchet);
  const timer = setInterval(() => void processEnrollmentActions(), ENROLLMENT_POLL_MS);
  const stopRecovery = startAssessmentRecovery();
  const stopHealth = startStudentHealthRefresh();
  const stopCalendar = startCalendarReconciliation();
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    stopRecovery();
    stopHealth();
    stopCalendar();
    void worker.stop();
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, shutdown);
  void processEnrollmentActions();
  logger.info({ slots: 1 }, "Worker starting");
  try {
    await runWithReadiness(worker);
  } finally {
    clearInterval(timer);
    stopRecovery();
    stopHealth();
    stopCalendar();
    await db.$disconnect();
  }
}
async function createWorker(
  hatchet: Awaited<ReturnType<typeof getHatchetClient>>,
): Promise<Awaited<ReturnType<Awaited<ReturnType<typeof getHatchetClient>>["worker"]>>> {
  const sessions = hatchet.task<SessionsGeneratePayload, GenerationResult>({
    name: SESSIONS_GENERATE_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) =>
      runJob(SESSIONS_GENERATE_WORKFLOW, () => processSessionGeneration({ database: db, payload })),
  });
  const files = hatchet.task<AssessmentFilePayload, { status: string }>({
    name: ASSESSMENT_FILE_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) =>
      runJob(ASSESSMENT_FILE_WORKFLOW, () => processAssessmentFile({ database: db, payload })),
  });
  const documents = hatchet.task<StudentDocumentPayload, { status: string }>({
    name: STUDENT_DOCUMENT_WORKFLOW,
    retries: 0,
    executionTimeout: "2m",
    scheduleTimeout: "5m",
    fn: (payload) =>
      runJob(STUDENT_DOCUMENT_WORKFLOW, () => processStudentDocumentPayload(payload)),
  });
  const worker = await hatchet.worker("school", {
    slots: 1,
    durableSlots: 1,
    workflows: [sessions, files, documents],
    handleKill: false,
  });
  return worker;
}
async function processStudentDocumentPayload(
  input: StudentDocumentPayload,
): Promise<{ status: string }> {
  const payload = studentDocumentPayloadSchema.parse(input);
  await processStudentDocument(db, { id: payload.fileId });
  const file = await db.studentDocumentFile.findFirst({
    where: { id: payload.fileId },
    select: { status: true },
  });
  if (file?.status === "FAILED") throw new Error("DOCUMENT_EXTRACTION_FAILED");
  return { status: file?.status ?? "SKIPPED" };
}
try {
  await start();
} catch (error) {
  logger.fatal(safeError(error), "Worker startup failed");
  process.exitCode = 1;
}
