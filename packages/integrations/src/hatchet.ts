import { readHatchetEnvironment } from "./hatchet/env.js";
import { createHash } from "node:crypto";
import type { HatchetClient } from "@hatchet-dev/typescript-sdk";
import {
  ASSESSMENT_FILE_WORKFLOW, assessmentFilePayloadSchema, type AssessmentFilePayload,
  SESSIONS_GENERATE_WORKFLOW,
  sessionsGeneratePayloadSchema,
  type SessionsGenerateQueue,
} from "@lazuli/job-contracts";

const DISPATCH_TIMEOUT_MS = 5000;
const NAMESPACE_HASH_LENGTH = 16;
export async function enqueueAssessmentFile(input: AssessmentFilePayload): Promise<void> {
  const payload = assessmentFilePayloadSchema.parse(input);
  await boundedDispatch(async () => { const hatchet = await getHatchetClient(); await hatchet.runNoWait(ASSESSMENT_FILE_WORKFLOW, payload); });
}
let client: Promise<HatchetClient> | undefined;

/** Shared Hatchet instances must never deliver one workspace's jobs to another database. */
export function sessionWorkflowNamespace(environment: {
  HATCHET_CLIENT_NAMESPACE?: string | undefined;
  DATABASE_URL?: string | undefined;
}): string {
  if (environment.HATCHET_CLIENT_NAMESPACE) return environment.HATCHET_CLIENT_NAMESPACE;
  if (!environment.DATABASE_URL) throw new Error("SESSION_DATABASE_UNCONFIGURED");
  const database = new URL(environment.DATABASE_URL);
  const identity = `${database.host}${database.pathname}`;
  return `lazuli-${createHash("sha256").update(identity).digest("hex").slice(0, NAMESPACE_HASH_LENGTH)}`;
}

export function getHatchetClient(): Promise<HatchetClient> {
  client ??= connect().catch((error: Error) => {
    client = undefined;
    throw error;
  });
  return client;
}

async function connect(): Promise<HatchetClient> {
  const environment = readHatchetEnvironment();
  const { HatchetClient } = await import("@hatchet-dev/typescript-sdk");
  return HatchetClient.init(
    {
      namespace: sessionWorkflowNamespace(environment),
      token: environment.HATCHET_CLIENT_TOKEN,
      log_level: "ERROR",
      retrier: { maxAttempts: 1 },
    },
    undefined,
    { timeout: DISPATCH_TIMEOUT_MS },
  );
}

export function createHatchetSessionsGenerateQueue(): SessionsGenerateQueue {
  return {
    async enqueueSessionsGenerate(input) {
      const payload = sessionsGeneratePayloadSchema.parse(input);
      const jobId = await boundedDispatch(async () => {
        const hatchet = await getHatchetClient();
        const run = await hatchet.runNoWait(SESSIONS_GENERATE_WORKFLOW, payload);
        return run.runId;
      });
      return { workflowName: SESSIONS_GENERATE_WORKFLOW, jobId, payload };
    },
  };
}

async function boundedDispatch<T>(dispatch: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dispatch(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("SESSION_DISPATCH_TIMEOUT")),
          DISPATCH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
