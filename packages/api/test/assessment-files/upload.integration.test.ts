import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { createCaller, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";
import { prepareFile, type FileInput } from "../../src/assessment-files/data.js";
import { receiveAssessmentFile } from "../../src/assessment-files/transport.js";
import {
  cleanEnrollmentFixtures,
  createPersonalizedClassFor,
  createStudentFor,
  ensureTeacherFor,
  seedTwoStageCatalogFor,
  ENROLLMENT_ADMIN_ID,
  type EnrollmentSuiteConfig,
} from "../support/enrollment/fixtures.js";

const config: EnrollmentSuiteConfig = {
  prefix: "Assessment File Claims 207 ",
  catalogKey: "assessment_file_claims207_line",
  catalogKeyPrefix: "assessment_file_claims207_",
  teacherId: "baed4fb4-dab5-4a43-88f6-7505ef4d4580",
  teacherEmail: "assessment-file-claims207@example.com",
  teacherName: "Assessment File Teacher",
  semesterName: "Assessment File Claims 207 2079.1",
  semesterStart: "2079-02-01",
  semesterEnd: "2079-06-30",
};
const now = new Date("2079-02-15T15:00:00Z");
const admin: StaffUser = {
  id: ENROLLMENT_ADMIN_ID,
  role: "ADMIN",
  name: "Assessment File Admin",
  email: "assessment-file-admin@example.com",
  isEnabled: true,
};
const teacher: StaffUser = {
  id: config.teacherId,
  role: "TEACHER",
  name: config.teacherName,
  email: config.teacherEmail,
  isEnabled: true,
};

async function cleanFixtures(): Promise<void> {
  await db.assessmentFile.deleteMany({
    where: { assessment: { student: { fullName: { startsWith: config.prefix } } } },
  });
  await cleanEnrollmentFixtures(config);
}
before(() => db.$connect());
beforeEach(cleanFixtures);
after(async () => {
  await cleanFixtures();
  await db.$disconnect();
});

async function fixture(): Promise<FileInput> {
  await ensureTeacherFor(config);
  const catalog = await seedTwoStageCatalogFor(config);
  const classRow = await createPersonalizedClassFor(config, {
    code: "source",
    semesterId: catalog.semesterId,
  });
  const student = await createStudentFor(config, { suffix: "Student" });
  const created = await createCaller({ db, staffUser: admin, now }).enrollment.create({
    studentId: student.id,
    classId: classRow.id,
    stageId: catalog.firstStageId,
  });
  return {
    id: randomUUID(),
    progressId: created.progress.id,
    phase: "BLOCK_ONE",
    fileName: "prova.pdf",
    contentType: "application/pdf",
    byteLength: 5,
  };
}
function request(input: FileInput): Request {
  return new Request("https://school.example/api/assessment-files", {
    method: "POST",
    body: "%PDF-",
    headers: {
      origin: "https://school.example",
      "x-upload-metadata": encodeURIComponent(JSON.stringify(input)),
    },
  });
}
async function claim(input: FileInput): Promise<void> {
  await db.$transaction((database) => prepareFile({ database, staffUser: teacher, now }, input));
}

void it("preserves an active upload and replays its received result without a second attachment", async () => {
  const input = await fixture();
  await claim(input);
  const context = { db, staffUser: teacher, now };
  const busy = await receiveAssessmentFile(context, request(input));
  assert.equal(busy.status, 400);
  assert.deepEqual(await busy.json(), {
    message:
      "Este arquivo ainda está sendo recebido. Aguarde alguns instantes antes de tentar novamente.",
  });
  const caller = createCaller(context);
  const uploading = await caller.assessmentFiles.list({ progressId: input.progressId });
  assert.deepEqual(
    uploading.map((file) => ({ id: file.id, status: file.status })),
    [{ id: input.id, status: "UPLOADING" }],
  );
  // Storage has accepted the bytes; a lost HTTP response must not cause a second upload.
  await db.assessmentFile.update({
    where: { id: input.id },
    data: { status: "RECEIVED", receivedAt: now },
  });
  const replay = await receiveAssessmentFile(context, request(input));
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { id: input.id, status: "RECEIVED" });
  const mismatch = await receiveAssessmentFile(
    context,
    request({ ...input, fileName: "outra.pdf" }),
  );
  assert.equal(mismatch.status, 400);
  assert.deepEqual(await mismatch.json(), {
    message: "O identificador deste envio já foi utilizado. Selecione o arquivo novamente.",
  });
  const files = await caller.assessmentFiles.list({ progressId: input.progressId });
  assert.deepEqual(
    files.map((file) => ({ id: file.id, status: file.status, fileName: file.fileName })),
    [{ id: input.id, status: "RECEIVED", fileName: "prova.pdf" }],
  );
});

void it("rejects another uploader reusing a teacher claim even when the caller is an administrator", async () => {
  const input = await fixture();
  await claim(input);
  const context = { db, staffUser: admin, now };
  const response = await receiveAssessmentFile(context, request(input));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "O identificador deste envio já foi utilizado. Selecione o arquivo novamente.",
  });
  const files = await createCaller(context).assessmentFiles.list({ progressId: input.progressId });
  assert.deepEqual(
    files.map((file) => ({ id: file.id, uploadedById: file.uploadedById, status: file.status })),
    [{ id: input.id, uploadedById: teacher.id, status: "UPLOADING" }],
  );
});
