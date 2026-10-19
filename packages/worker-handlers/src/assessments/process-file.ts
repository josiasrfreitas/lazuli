import { createHash } from "node:crypto";
import type { DatabaseClient } from "@lazuli/db";
import { assessmentFilePayloadSchema, type AssessmentFilePayload } from "@lazuli/job-contracts";
import { getStorage } from "@lazuli/storage";

/** Only opaque identifiers/status leave this handler. File content and names stay private. */
export async function processAssessmentFile({ database, payload }: { database: DatabaseClient; payload: AssessmentFilePayload }) {
  const { fileId } = assessmentFilePayloadSchema.parse(payload);
  const claimedAt = new Date();
  const claimed = await database.assessmentFile.updateMany({ where: { id: fileId, removedAt: null, OR: [{ status: "RECEIVED" }, { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 300_000) } }] }, data: { status: "PROCESSING", updatedAt: claimedAt } });
  if (!claimed.count) return { status: "SKIPPED" };
  const where = { id: fileId, status: "PROCESSING" as const, updatedAt: claimedAt, removedAt: null };
  try {
    const row = await database.assessmentFile.findUniqueOrThrow({ where: { id: fileId } });
    if (!row.bucket || !row.key) throw new Error("FILE_NOT_RECEIVED");
    const file = await getStorage().read({ bucket: row.bucket, key: row.key });
    const signatures: Record<string, number[]> = {
      "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    };
    if (file.bytes.length !== row.byteLength || !signatures[row.contentType]?.every((byte, index) => file.bytes[index] === byte)) {
      await database.assessmentFile.updateMany({ where, data: { status: "REJECTED", failureCode: "INVALID_FILE", processedAt: new Date() } });
      return { status: "REJECTED" };
    }
    const checksum = createHash("sha256").update(file.bytes).digest("hex");
    await database.assessmentFile.updateMany({ where, data: { status: "READY", checksum, failureCode: null, processedAt: new Date() } });
    return { status: "READY" };
  } catch {
    await database.assessmentFile.updateMany({ where, data: { status: "FAILED", failureCode: "PROCESSING" } });
    return { status: "FAILED" };
  }
}

export async function recoverAssessmentFiles(database: DatabaseClient): Promise<void> {
  const rows = await database.assessmentFile.findMany({ where: { removedAt: null, OR: [{ status: "RECEIVED" }, { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 300_000) } }] }, select: { id: true }, orderBy: { createdAt: "asc" }, take: 10 });
  for (const row of rows) await processAssessmentFile({ database, payload: { fileId: row.id } });
}
