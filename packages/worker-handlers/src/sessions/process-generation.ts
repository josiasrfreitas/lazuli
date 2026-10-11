import type { DatabaseClient } from "@lazuli/db";
import { sessionsGeneratePayloadSchema, type SessionsGeneratePayload } from "@lazuli/job-contracts";
import { generateClassSessions, type SessionGenerationResult } from "./generate.js";

/** Only identifiers and counts cross Hatchet; all school data stays in the database. */
export async function processSessionGeneration(input: {
  database: DatabaseClient;
  payload: SessionsGeneratePayload;
}): Promise<SessionGenerationResult> {
  const payload = sessionsGeneratePayloadSchema.parse(input.payload);
  if (!payload.requestId) throw new Error("SESSION_REQUEST_REQUIRED");
  const requestId = payload.requestId;
  try {
    const original = await input.database.sessionGenerationRequest.findFirst({
      where: { id: requestId, deletedAt: null },
    });
    if (
      !original ||
      original.classId !== (payload.classId ?? null) ||
      original.semesterId !== (payload.semesterId ?? null)
    )
      throw new Error("SESSION_REQUEST_SCOPE_MISMATCH");
    await input.database.sessionGenerationRequest.updateMany({
      where: { id: requestId, deletedAt: null, status: { in: ["PENDING", "QUEUED", "FAILED"] } },
      data: { status: "RUNNING", startedAt: new Date(), completedAt: null, failureCode: null },
    });
    return await input.database.$transaction(
      async (database) => {
        await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`session-request:${requestId}`}, 0))`;
        const request = await database.sessionGenerationRequest.findFirst({
          where: { id: requestId, deletedAt: null },
        });
        if (
          !request ||
          request.classId !== (payload.classId ?? null) ||
          request.semesterId !== (payload.semesterId ?? null)
        ) {
          throw new Error("SESSION_REQUEST_SCOPE_MISMATCH");
        }
        if (request.status === "SUCCEEDED") {
          return {
            classesMatched: request.classesMatched ?? 0,
            sessionsCreated: request.sessionsCreated ?? 0,
            sessionsPlanned: request.sessionsPlanned ?? 0,
          };
        }
        const result = await generateClassSessions({ database, payload });
        await database.sessionGenerationRequest.update({
          where: { id: requestId },
          data: { ...result, status: "SUCCEEDED", completedAt: new Date(), failureCode: null },
        });
        return result;
      },
      { timeout: 60_000 },
    );
  } catch {
    try {
      await input.database.sessionGenerationRequest.updateMany({
        where: {
          id: requestId,
          classId: payload.classId ?? null,
          semesterId: payload.semesterId ?? null,
          status: { not: "SUCCEEDED" },
        },
        data: { status: "FAILED", failureCode: "GENERATION_FAILED", completedAt: new Date() },
      });
    } catch {
      // A database outage leaves a stale request; the UI permits a fresh attempt after five minutes.
    }
    // Never let ORM errors or query parameters containing school data reach worker logs.
    throw new Error("SESSION_GENERATION_FAILED");
  }
}
