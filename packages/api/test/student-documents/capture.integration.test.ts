import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import { getStorage } from "@lazuli/storage";
import { createCaller, type StaffUser } from "../../src/index.js";
import {
  studentDocumentCapture,
  downloadStudentDocument,
} from "../../src/student-documents/transport.js";
import { attachDocumentSession } from "../../src/student-documents/router.js";
const owner: StaffUser = {
  id: randomUUID(),
  name: "Document Test",
  email: "document-test@example.invalid",
  role: "ADMIN",
  isEnabled: true,
};
const other: StaffUser = { ...owner, id: randomUUID() };
const context = { db, staffUser: owner };
const caller = createCaller(context);
const studentIds: string[] = [];
after(async () => {
  const files = await db.studentDocumentFile.findMany({
    where: { session: { createdById: owner.id } },
  });
  for (const file of files) await getStorage().remove(file);
  await db.studentDocumentFile.deleteMany({ where: { session: { createdById: owner.id } } });
  await db.studentDocumentSession.deleteMany({ where: { createdById: owner.id } });
  await db.student.deleteMany({ where: { id: { in: studentIds } } });
  await db.$disconnect();
});
function request(token: string, post = false): Request {
  return new Request("http://localhost/api/student-documents", {
    method: post ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
    ...(post ? { body: Buffer.from([255, 216, 255, 217]) } : {}),
  });
}
async function statusOf(response: Promise<Response>): Promise<number> {
  const resolved = await response;
  return resolved.status;
}
void it("a capability accepts private attachments, rejects unauthorized reading and closes atomically with enrollment", async () => {
  const session = await caller.studentDocuments.create({});
  const uploaded = await studentDocumentCapture(
    { db, staffUser: null },
    { request: request(session.token, true), kind: "residence" },
  );
  assert.equal(uploaded.status, 201);
  const status = await caller.studentDocuments.status({ id: session.id });
  assert.equal(status.files[0]?.status, "READY");
  assert.equal(status.files[0]?.extraction, null);
  const fileId = status.files[0]?.id;
  assert.ok(fileId);
  assert.equal(await statusOf(downloadStudentDocument({ db, staffUser: null }, fileId)), 403);
  assert.equal(await statusOf(downloadStudentDocument({ db, staffUser: other }, fileId)), 404);
  const download = await downloadStudentDocument(context, fileId);
  assert.equal(download.status, 200);
  assert.deepEqual(
    new Uint8Array(await download.arrayBuffer()),
    Uint8Array.from([255, 216, 255, 217]),
  );
  await assert.rejects(
    createCaller({ db, staffUser: other }).studentDocuments.status({ id: session.id }),
    /Sessão não encontrada/u,
  );
  const student = await db.student.create({ data: { fullName: "Synthetic Document Student" } });
  studentIds.push(student.id);
  await assert.rejects(
    db.$transaction(async (tx) => {
      await attachDocumentSession(tx, {
        sessionId: session.id,
        studentId: student.id,
        ownerId: owner.id,
      });
      throw new Error("ROLLBACK");
    }),
    /ROLLBACK/u,
  );
  assert.equal(
    await statusOf(
      studentDocumentCapture({ db, staffUser: null }, { request: request(session.token) }),
    ),
    200,
  );
  await db.$transaction((tx) =>
    attachDocumentSession(tx, { sessionId: session.id, studentId: student.id, ownerId: owner.id }),
  );
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request(session.token, true), kind: "residence" },
      ),
    ),
    410,
  );
  const linked = await db.studentDocumentFile.findFirstOrThrow({
    where: { id: fileId },
    include: { session: true },
  });
  assert.equal(linked.session.studentId, student.id);
});
void it("identities enter the worker queue while profile photos bypass OCR", async () => {
  const session = await caller.studentDocuments.create({});
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request(session.token, true), kind: "student" },
      ),
    ),
    201,
  );
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request(session.token, true), kind: "photo" },
      ),
    ),
    201,
  );
  const status = await caller.studentDocuments.status({ id: session.id });
  const rows = status.files;
  assert.equal(rows.find((file) => file.kind === "student")?.status, "RECEIVED");
  assert.equal(rows.find((file) => file.kind === "photo")?.status, "READY");
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request(session.token, true), kind: "student" },
      ),
    ),
    409,
  );
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request("invalid"), kind: "student" },
      ),
    ),
    410,
  );
  await assert.rejects(
    createCaller({ db, staffUser: { ...owner, role: "TEACHER" } }).studentDocuments.create({}),
    { code: "FORBIDDEN" },
  );
});
void it("hides deleted attachments from capture and staff views", async () => {
  const session = await caller.studentDocuments.create({});
  const capture = request(session.token, true);
  assert.equal(
    await statusOf(
      studentDocumentCapture({ db, staffUser: null }, { request: capture, kind: "residence" }),
    ),
    201,
  );
  const before = await caller.studentDocuments.status({ id: session.id });
  const fileId = before.files[0]?.id;
  assert.ok(fileId);
  const deletion = new Request("http://localhost/api/student-documents/residence", {
    method: "DELETE",
    headers: { authorization: `Bearer ${session.token}` },
  });
  assert.equal(
    await statusOf(
      studentDocumentCapture({ db, staffUser: null }, { request: deletion, kind: "residence" }),
    ),
    200,
  );
  const afterDeletion = await caller.studentDocuments.status({ id: session.id });
  assert.deepEqual(afterDeletion.files, []);
  assert.equal(await statusOf(downloadStudentDocument(context, fileId)), 404);
  assert.equal(
    await statusOf(
      studentDocumentCapture(
        { db, staffUser: null },
        { request: request(session.token), kind: "residence" },
      ),
    ),
    404,
  );
});
