import type { Prisma, ClassSession, SessionGenerationRequest } from "@lazuli/db";
import { notFound } from "../trpc/errors.js";
import { CLASS_NOT_FOUND_MESSAGE } from "../classes/errors.js";
import { GENERATION_STALE_MS } from "./requests.js";

type Database = Pick<
  Prisma.TransactionClient,
  "class" | "classSession" | "sessionGenerationRequest"
>;

type GenerationClass = { semesterId: string; status: string; _count: { sessions: number } };
export type ClassGeneration = {
  request: Pick<
    SessionGenerationRequest,
    "id" | "status" | "createdAt" | "startedAt" | "completedAt"
  > | null;
  pending: boolean;
  stale: boolean;
  sessionCount: number;
  canGenerate: boolean;
};
async function generationClass(database: Database, id: string): Promise<GenerationClass> {
  const row = await database.class.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      semesterId: true,
      _count: { select: { sessions: { where: { deletedAt: null } } } },
    },
  });
  if (!row) throw notFound(CLASS_NOT_FOUND_MESSAGE);
  return row;
}

export async function readClassGeneration(
  database: Database,
  input: { id: string; now: Date },
): Promise<ClassGeneration> {
  const { id, now } = input;
  const row = await generationClass(database, id);
  const request = await database.sessionGenerationRequest.findFirst({
    where: { deletedAt: null, OR: [{ classId: id }, { semesterId: row.semesterId }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, status: true, createdAt: true, startedAt: true, completedAt: true },
  });
  const pending = request !== null && ["PENDING", "QUEUED", "RUNNING"].includes(request.status);
  const stale =
    pending &&
    now.getTime() - (request.startedAt ?? request.createdAt).getTime() >= GENERATION_STALE_MS;
  return {
    request,
    pending,
    stale,
    sessionCount: row._count.sessions,
    canGenerate: row.status === "ACTIVE" && (!pending || stale),
  };
}

export async function readClassSessions(
  database: Database,
  input: { id: string; page: number; pageSize: number },
): Promise<{
  rows: Pick<ClassSession, "id" | "date" | "startTime" | "endTime" | "status">[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  await generationClass(database, input.id);
  const where = { classId: input.id, deletedAt: null };
  const total = await database.classSession.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  const rows = await database.classSession.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
    skip: (page - 1) * input.pageSize,
    take: input.pageSize,
    select: { id: true, date: true, startTime: true, endTime: true, status: true },
  });
  return { rows, total, page, pageSize: input.pageSize, pageCount };
}
