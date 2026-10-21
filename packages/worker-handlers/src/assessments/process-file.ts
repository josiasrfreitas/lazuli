import { createHash } from "node:crypto";
import type { DatabaseClient, Prisma } from "@lazuli/db";
import { assessmentFilePayloadSchema, type AssessmentFilePayload } from "@lazuli/job-contracts";
import { getStorage } from "@lazuli/storage";

const CLAIM_TIMEOUT_MS = 300_000;
const RECOVERY_BATCH_SIZE = 10;
const signatures: Readonly<Record<string, Uint8Array>> = {
  "application/pdf": Buffer.from("255044462d", "hex"),
  "image/jpeg": Buffer.from("ffd8ff", "hex"),
  "image/png": Buffer.from("89504e470d0a1a0a", "hex"),
};
type ProcessingResult = { status: "SKIPPED" | "REJECTED" | "READY" | "FAILED" };

function recoverableFiles(): Prisma.AssessmentFileWhereInput {
  return {
    removedAt: null,
    OR: [
      { status: "RECEIVED" },
      { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) } },
    ],
  };
}

/** Only opaque identifiers/status leave this handler. File content and names stay private. */
export async function processAssessmentFile({
  database,
  payload,
}: {
  database: DatabaseClient;
  payload: AssessmentFilePayload;
}): Promise<ProcessingResult> {
  const { fileId } = assessmentFilePayloadSchema.parse(payload);
  const claimedAt = new Date();
  const claimed = await database.assessmentFile.updateMany({
    where: { id: fileId, ...recoverableFiles() },
    data: { status: "PROCESSING", updatedAt: claimedAt },
  });
  if (!claimed.count) return { status: "SKIPPED" };
  return inspectClaimedFile(database, {
    id: fileId,
    status: "PROCESSING",
    updatedAt: claimedAt,
    removedAt: null,
  });
}

async function inspectClaimedFile(
  database: DatabaseClient,
  where: {
    id: string;
    status: "PROCESSING";
    updatedAt: Date;
    removedAt: null;
  },
): Promise<ProcessingResult> {
  try {
    const row = await database.assessmentFile.findUniqueOrThrow({ where: { id: where.id } });
    if (!row.bucket || !row.key) throw new Error("FILE_NOT_RECEIVED");
    const file = await getStorage().read({ bucket: row.bucket, key: row.key });
    if (file.bytes.length !== row.byteLength || !matchesSignature(file.bytes, row.contentType)) {
      await database.assessmentFile.updateMany({
        where,
        data: { status: "REJECTED", failureCode: "INVALID_FILE", processedAt: new Date() },
      });
      return { status: "REJECTED" };
    }
    const checksum = createHash("sha256").update(file.bytes).digest("hex");
    await database.assessmentFile.updateMany({
      where,
      data: { status: "READY", checksum, failureCode: null, processedAt: new Date() },
    });
    return { status: "READY" };
  } catch {
    await database.assessmentFile.updateMany({
      where,
      data: { status: "FAILED", failureCode: "PROCESSING" },
    });
    return { status: "FAILED" };
  }
}

function matchesSignature(bytes: Uint8Array, contentType: string): boolean {
  return signatures[contentType]?.every((byte, index) => bytes[index] === byte) ?? false;
}

export async function recoverAssessmentFiles(database: DatabaseClient): Promise<void> {
  const rows = await database.assessmentFile.findMany({
    where: recoverableFiles(),
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: RECOVERY_BATCH_SIZE,
  });
  for (const row of rows) await processAssessmentFile({ database, payload: { fileId: row.id } });
}
