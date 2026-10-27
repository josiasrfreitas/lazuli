import { randomUUID } from "node:crypto";
import { getStorage } from "@lazuli/storage";
import type { StoredFileReference } from "@lazuli/storage";
import { Prisma } from "@lazuli/db/prisma";
import type { DatabaseClient } from "@lazuli/db";

export const JPEG = "image/jpeg";
export const PDF = "application/pdf";
export function documentFormat(key: string): "pdf" | "image" {
  return key.endsWith(".pdf") ? "pdf" : "image";
}
const MAX_BYTES = 5_242_880;
const JPEG_SIGNATURE = Buffer.from("ffd8ff", "hex");
export async function readDocumentImage(request: Request): Promise<Uint8Array> {
  const contentType = request.headers.get("content-type");
  if (contentType !== JPEG && contentType !== PDF) throw new Error("IMAGE");
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = request.body?.getReader();
  if (!reader) throw new Error("IMAGE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("IMAGE");
    }
    chunks.push(part.value);
  }
  const bytes = Buffer.concat(chunks);
  const signature = contentType === PDF ? Buffer.from("%PDF-") : JPEG_SIGNATURE;
  if (!bytes.subarray(0, signature.length).equals(signature)) throw new Error("IMAGE");
  return bytes;
}
export async function storeDocument(
  database: DatabaseClient,
  input: {
    sessionId: string;
    tokenHash: string;
    kind: string;
    bytes: Uint8Array;
    contentType?: typeof JPEG | typeof PDF;
  },
): Promise<{ id: string; status: string; updatedAt: Date }> {
  const storage = getStorage();
  const contentType = input.contentType ?? JPEG;
  if (contentType === PDF && input.kind === "photo") throw new Error("IMAGE");
  const reference = await storage.put({
    key: `student-documents/${randomUUID()}.${contentType === PDF ? "pdf" : "jpg"}`,
    bytes: input.bytes,
    contentType,
  });
  try {
    const result = await database.$transaction(async (transaction) => {
      const locked = await transaction.studentDocumentSession.updateMany({
        where: { id: input.sessionId, closedAt: null, deletedAt: null },
        data: { tokenHash: input.tokenHash },
      });
      if (!locked.count) throw new Error("CLOSED");
      const where = { sessionId_kind: { sessionId: input.sessionId, kind: input.kind } };
      const previous = await transaction.studentDocumentFile.findUnique({ where });
      if (previous && !previous.deletedAt && ["RECEIVED", "PROCESSING"].includes(previous.status))
        throw new Error("BUSY");
      const data = documentData(reference, { ...input, contentType });
      const file = await transaction.studentDocumentFile.upsert({
        where,
        create: { ...data, sessionId: input.sessionId, kind: input.kind },
        update: data,
        select: { id: true, status: true, updatedAt: true },
      });
      return { old: previous, file };
    });
    if (result.old) await storage.remove(result.old).catch((): void => {});
    return result.file;
  } catch (error) {
    await storage.remove(reference).catch((): void => {});
    throw error;
  }
}
function documentData(
  reference: StoredFileReference,
  input: { bytes: Uint8Array; kind: string; contentType: typeof JPEG | typeof PDF },
): StoredFileReference & {
  byteLength: number;
  status: string;
  deletedAt: null;
  extraction: typeof Prisma.DbNull;
} {
  return {
    ...reference,
    byteLength: input.bytes.length,
    status:
      input.contentType !== PDF && (input.kind === "student" || input.kind === "guardian")
        ? "RECEIVED"
        : "READY",
    deletedAt: null,
    extraction: Prisma.DbNull,
  };
}
