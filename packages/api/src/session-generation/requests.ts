import type { Prisma } from "@lazuli/db";
import {
  SESSIONS_GENERATE_WORKFLOW,
  createUnavailableSessionsGenerateQueue,
  enqueueSessionsGenerate,
  type SessionsGenerateQueue,
} from "@lazuli/job-contracts";
import { TRPCError } from "@trpc/server";

type Scope = { classId?: string; semesterId?: string };
type Database = Pick<Prisma.TransactionClient, "sessionGenerationRequest">;
export const GENERATION_STALE_MS = 5 * 60_000;

/** Persist this alongside class creation/publication, before attempting external dispatch. */
export async function requestSessionGeneration(
  database: Prisma.TransactionClient,
  scope: Scope,
  requestedById: string,
  now: Date,
) {
  const scopeId = scope.classId ?? scope.semesterId;
  if (!scopeId || Boolean(scope.classId) === Boolean(scope.semesterId))
    throw new Error("INVALID_SESSION_SCOPE");
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sessions:${scopeId}`}, 0))`;
  const active = await database.sessionGenerationRequest.findFirst({
    where: {
      ...scope,
      deletedAt: null,
      status: { in: ["PENDING", "QUEUED", "RUNNING"] },
      createdAt: { gt: new Date(now.getTime() - GENERATION_STALE_MS) },
    },
  });
  if (active)
    throw new TRPCError({
      code: "CONFLICT",
      message: "As aulas já estão sendo preparadas. Aguarde alguns instantes.",
    });
  return database.sessionGenerationRequest.create({
    data: { ...scope, requestedById, createdAt: now },
  });
}

/** A dispatch failure must not turn a saved class into a failed form submission. */
export async function dispatchSessionGeneration(input: {
  database: Database;
  requestId: string;
  queue?: SessionsGenerateQueue;
}) {
  const request = await input.database.sessionGenerationRequest.findUniqueOrThrow({
    where: { id: input.requestId },
  });
  const payload = {
    requestId: request.id,
    ...(request.classId ? { classId: request.classId } : { semesterId: request.semesterId ?? "" }),
  };
  try {
    const result = await enqueueSessionsGenerate({
      queue: input.queue ?? createUnavailableSessionsGenerateQueue(),
      payload,
    });
    await input.database.sessionGenerationRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: { status: "QUEUED" },
    });
    await input.database.sessionGenerationRequest.update({
      where: { id: request.id },
      data: { jobId: result.jobId },
    });
  } catch {
    await input.database.sessionGenerationRequest.updateMany({
      where: { id: request.id, status: { in: ["PENDING", "QUEUED"] } },
      data: { status: "FAILED", failureCode: "DISPATCH_FAILED", completedAt: new Date() },
    });
  }
  const current = await input.database.sessionGenerationRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  return {
    id: current.id,
    workflowName: SESSIONS_GENERATE_WORKFLOW,
    jobId: current.jobId,
    status: current.status,
    payload,
  };
}
