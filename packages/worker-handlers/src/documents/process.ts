import type { DatabaseClient } from "@lazuli/db";
import { extractIdentityDocument } from "@lazuli/domain";
import { textractIdentityOcr, type IdentityOcr } from "@lazuli/integrations/identity-ocr";
import { getStorage, type Storage } from "@lazuli/storage";

const LEASE_MS = 300_000;
export async function processStudentDocument(
  database: DatabaseClient,
  { id, dependencies }: { id: string; dependencies?: { ocr: IdentityOcr; storage: Storage } },
): Promise<void> {
  const claimedAt = new Date();
  const claimed = await database.studentDocumentFile.updateMany({
    where: {
      id,
      deletedAt: null,
      OR: [
        { status: "RECEIVED" },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - LEASE_MS) } },
      ],
    },
    data: { status: "PROCESSING", updatedAt: claimedAt },
  });
  if (!claimed.count) return;
  const where = { id, deletedAt: null, status: "PROCESSING", updatedAt: claimedAt };
  try {
    const row = await database.studentDocumentFile.findFirst({ where });
    if (!row) return;
    const file = await (dependencies?.storage ?? getStorage()).read(row);
    const lines = await (dependencies?.ocr ?? textractIdentityOcr).read(file.bytes);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
    const result = extractIdentityDocument({ lines, today });
    // Persist the minimal reviewable result, never OCR text or PII in workflow output/logs.
    const extraction = {
      family: result.family,
      fields: Object.fromEntries(
        Object.entries(result.fields).map(([key, field]) => [key, field.value]),
      ),
    };
    await database.studentDocumentFile.updateMany({ where, data: { status: "READY", extraction } });
  } catch {
    await database.studentDocumentFile.updateMany({ where, data: { status: "FAILED" } });
  }
}
export async function recoverStudentDocuments(database: DatabaseClient): Promise<void> {
  const files = await database.studentDocumentFile.findMany({
    where: {
      OR: [
        { status: "RECEIVED" },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - LEASE_MS) } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const file of files) await processStudentDocument(database, { id: file.id });
}
