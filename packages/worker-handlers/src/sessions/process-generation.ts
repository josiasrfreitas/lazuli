import type { DatabaseClient, SessionGenerationRequest } from "@lazuli/db";
import { sessionsGeneratePayloadSchema, type SessionsGeneratePayload } from "@lazuli/job-contracts";
import { generateClassSessions, type SessionGenerationResult } from "../index.js";

type ScopedPayload = SessionsGeneratePayload & { requestId: string };
type GenerationInput = { database: DatabaseClient; payload: ScopedPayload };
const GENERATION_TIMEOUT_MS = 60_000;

/** Only identifiers and counts cross Hatchet; all school data stays in the database. */
export async function processSessionGeneration(input: {
  database: DatabaseClient;
  payload: SessionsGeneratePayload;
}): Promise<SessionGenerationResult> {
  const values = sessionsGeneratePayloadSchema.parse(input.payload);
  if (!values.requestId) throw new Error("SESSION_REQUEST_REQUIRED");
  const payload = { ...values, requestId: values.requestId };
  try {
    const original = await input.database.sessionGenerationRequest.findFirst({
      where: { id: payload.requestId, deletedAt: null },
    });
    assertRequestScope(original, payload);
    await input.database.sessionGenerationRequest.updateMany({
      where: {
        id: payload.requestId,
        deletedAt: null,
        status: { in: ["PENDING", "QUEUED", "FAILED"] },
      },
      data: { status: "RUNNING", startedAt: new Date(), completedAt: null, failureCode: null },
    });
    return await executeGeneration({ database: input.database, payload });
  } catch {
    await recordGenerationFailure({ database: input.database, payload });
    throw new Error("SESSION_GENERATION_FAILED");
  }
}

async function executeGeneration({
  database,
  payload,
}: GenerationInput): Promise<SessionGenerationResult> {
  return database.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`session-request:${payload.requestId}`}, 0))`;
      const request = await transaction.sessionGenerationRequest.findFirst({
        where: { id: payload.requestId, deletedAt: null },
      });
      assertRequestScope(request, payload);
      if (request.status === "SUCCEEDED")
        return {
          classesMatched: request.classesMatched ?? 0,
          sessionsCreated: request.sessionsCreated ?? 0,
          sessionsPlanned: request.sessionsPlanned ?? 0,
        };
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('lazuli:teaching-schedule',158))`;
      const result = await generateClassSessions({ database: transaction, payload });
      await transaction.sessionGenerationRequest.update({
        where: { id: payload.requestId },
        data: { ...result, status: "SUCCEEDED", completedAt: new Date(), failureCode: null },
      });
      return result;
    },
    { timeout: GENERATION_TIMEOUT_MS },
  );
}
function assertRequestScope(
  request: SessionGenerationRequest | null,
  payload: ScopedPayload,
): asserts request is SessionGenerationRequest {
  if (
    !request ||
    request.classId !== (payload.classId ?? null) ||
    request.semesterId !== (payload.semesterId ?? null)
  )
    throw new Error("SESSION_REQUEST_SCOPE_MISMATCH");
}
async function recordGenerationFailure({ database, payload }: GenerationInput): Promise<void> {
  try {
    await database.sessionGenerationRequest.updateMany({
      where: {
        id: payload.requestId,
        deletedAt: null,
        classId: payload.classId ?? null,
        semesterId: payload.semesterId ?? null,
        status: { not: "SUCCEEDED" },
      },
      data: { status: "FAILED", failureCode: "GENERATION_FAILED", completedAt: new Date() },
    });
  } catch {
    // A database outage leaves a stale request; the UI permits a fresh attempt after five minutes.
  }
}
