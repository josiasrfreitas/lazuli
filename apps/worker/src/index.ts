import { processAssessmentFile } from "@lazuli/worker-handlers/assessment-files";
import { processStudentDocument } from "@lazuli/worker-handlers/student-documents";
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
import { runJob } from "./run-job.js";
import { createPeriodicTasks } from "./periodic-tasks.js";
import { safeError } from "@lazuli/logging";
import { logger } from "./logger.js";

type GenerationResult = Awaited<ReturnType<typeof processSessionGeneration>>;
async function start(): Promise<void> {
  const hatchet = await getHatchetClient();
  const worker = await createWorker(hatchet);
  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    void worker.stop();
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, shutdown);
  logger.info({ slots: 1 }, "Worker starting");
  try {
    await runWithReadiness(worker);
  } finally {
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
    workflows: [sessions, files, documents, ...createPeriodicTasks(hatchet)],
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
