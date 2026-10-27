import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import type { Storage } from "@lazuli/storage";
import { processStudentDocument } from "../../src/documents/process.js";
const owner = randomUUID();
const storage: Storage = {
  put: () => Promise.reject(new Error("unused")),
  remove: () => Promise.resolve(),
  read: () =>
    Promise.resolve({ bytes: Uint8Array.from([255, 216, 255]), contentType: "image/jpeg" }),
};
after(async () => {
  await db.studentDocumentFile.deleteMany({ where: { session: { createdById: owner } } });
  await db.studentDocumentSession.deleteMany({ where: { createdById: owner } });
  await db.$disconnect();
});
async function file(): Promise<string> {
  const session = await db.studentDocumentSession.create({
    data: { createdById: owner, tokenHash: randomUUID() },
  });
  const document = await db.studentDocumentFile.create({
    data: { sessionId: session.id, kind: "student", bucket: "test", key: "test", byteLength: 3 },
  });
  return document.id;
}
void it("the worker extracts through the provider abstraction and stores fields without raw OCR text", async () => {
  const id = await file();
  await processStudentDocument(db, {
    id,
    dependencies: {
      storage,
      ocr: {
        read: () =>
          Promise.resolve([
            { id: "cpf", page: 1, text: "Registro Geral - CPF / Personal Number: 529.982.247-25" },
            { id: "birth", page: 1, text: "Date de Nascimento / Date of Birth: 03/07/1988" },
            { id: "name", page: 1, text: "Nome / Name: MARIA EXEMPLO" },
          ]),
      },
    },
  });
  const row = await db.studentDocumentFile.findUniqueOrThrow({ where: { id } });
  assert.equal(row.status, "READY");
  assert.deepEqual(row.extraction, {
    family: "cin",
    fields: { name: "MARIA EXEMPLO", cpf: "529.982.247-25", rg: null, birthDate: "03/07/1988" },
  });
});
void it("failed OCR preserves the attachment and does not invent extracted values", async () => {
  const id = await file();
  await processStudentDocument(db, {
    id,
    dependencies: {
      storage,
      ocr: { read: () => Promise.reject(new Error("provider unavailable")) },
    },
  });
  const row = await db.studentDocumentFile.findUniqueOrThrow({ where: { id } });
  assert.equal(row.status, "FAILED");
  assert.equal(row.key, "test");
  assert.equal(row.extraction, null);
});
