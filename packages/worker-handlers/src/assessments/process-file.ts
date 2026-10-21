import { createHash } from "node:crypto";
import type { DatabaseClient } from "@lazuli/db";
import { assessmentFilePayloadSchema, type AssessmentFilePayload } from "@lazuli/job-contracts";
import { getStorage, type StoredFile } from "@lazuli/storage";

const PROCESSING_LEASE_MS = 300_000;
const FILE_SIGNATURES: Readonly<Record<string, Uint8Array>> = {
  "application/pdf": Buffer.from("%PDF-"),
  "image/jpeg": Buffer.from("ffd8ff", "hex"),
  "image/png": Buffer.from("89504e470d0a1a0a", "hex"),
};
type FileResult = { status: "SKIPPED" | "REJECTED" | "READY" | "FAILED" };

/** Only opaque identifiers/status leave this handler. File content and names stay private. */
export async function processAssessmentFile({
  database,
  payload,
}: {
  database: DatabaseClient;
  payload: AssessmentFilePayload;
}): Promise<FileResult> {
  const { fileId } = assessmentFilePayloadSchema.parse(payload);
  const claimedAt = await claimFile(database, fileId);
  if (!claimedAt) return { status: "SKIPPED" };
  const where = {
    id: fileId,
    status: "PROCESSING" as const,
    updatedAt: claimedAt,
    removedAt: null,
  };
  try {
    const row = await database.assessmentFile.findUniqueOrThrow({ where: { id: fileId } });
    if (!row.bucket || !row.key) throw new Error("FILE_NOT_RECEIVED");
    const file = await getStorage().read({ bucket: row.bucket, key: row.key });
    if (!matchesFile(row, file)) {
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

export async function recoverAssessmentFiles(database: DatabaseClient): Promise<void> {
  const rows = await database.assessmentFile.findMany({
    where: {
      removedAt: null,
      OR: [
        { status: "RECEIVED" },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - PROCESSING_LEASE_MS) } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  for (const row of rows) await processAssessmentFile({ database, payload: { fileId: row.id } });
}

async function claimFile(database: DatabaseClient, fileId: string): Promise<Date | null> {
  const claimedAt = new Date();
  const claimed = await database.assessmentFile.updateMany({
    where: {
      id: fileId,
      removedAt: null,
      OR: [
        { status: "RECEIVED" },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - PROCESSING_LEASE_MS) } },
      ],
    },
    data: { status: "PROCESSING", updatedAt: claimedAt },
  });
  return claimed.count ? claimedAt : null;
}

function matchesFile(row: { byteLength: number; contentType: string }, file: StoredFile): boolean {
  return (
    file.bytes.length === row.byteLength &&
    Boolean(FILE_SIGNATURES[row.contentType]?.every((byte, index) => file.bytes[index] === byte))
  );
}
