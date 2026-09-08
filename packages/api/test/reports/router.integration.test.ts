import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import { db } from "@lazuli/db";
import { TRPCError } from "@trpc/server";

import {
  ADMIN,
  caller,
  cleanReportsDatabase,
  ensureAdminUser,
  recordingReportGenerateQueue,
  seedOwnedClass,
  seedStudent,
  TEACHER,
} from "../support/reports-test-support.js";

void before(async () => {
  await db.$connect();
});

void after(async () => {
  await cleanReportsDatabase();
  await db.$disconnect();
});

void it("creates an overdue CSV artifact and enqueues report-generate", async () => {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { queue, calls } = recordingReportGenerateQueue("job-db");

  const result = await caller({ queue }).reports.requestOverdueCsv({});

  const artifact = await db.generatedArtifact.findUniqueOrThrow({
    where: { id: result.artifactId },
  });

  assert.equal(result.jobId, `job-db:${result.artifactId}`);
  assert.equal(artifact.kind, "OVERDUE_RECEIVABLES_CSV");
  assert.equal(artifact.requestedById, ADMIN.id);
  assert.equal(artifact.completedAt, null);
  assert.deepEqual(calls, [{ artifactId: result.artifactId }]);
});

void it("returns queued status from getArtifact before worker completion", async () => {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { studentId } = await seedStudent();
  const created = await caller().reports.requestStudentStatement({ studentId });
  const artifact = await caller().reports.getArtifact({ id: created.artifactId });

  assert.equal(artifact.status, "queued");
  assert.equal(artifact.studentId, studentId);
  assert.equal(artifact.completedAt, null);
});

void it("rejects teacher overdue CSV requests with FORBIDDEN", async () => {
  await cleanReportsDatabase();
  await assert.rejects(
    caller({ staffUser: TEACHER }).reports.requestOverdueCsv({}),
    (error: unknown) => error instanceof TRPCError && error.code === "FORBIDDEN",
  );
});

void it("lets a teacher request a roster for an owned class", async () => {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { classId } = await seedOwnedClass();
  const result = await caller({ staffUser: TEACHER }).reports.requestClassRoster({ classId });

  const artifact = await db.generatedArtifact.findUniqueOrThrow({
    where: { id: result.artifactId },
  });

  assert.equal(artifact.kind, "CLASS_ROSTER_PDF");
  assert.equal(artifact.classId, classId);
});
