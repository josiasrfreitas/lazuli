import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";
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
} from "./reports-test-support.js";

void describe("reports router", { concurrency: false }, () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanReportsDatabase();
    await db.$disconnect();
  });

  databaseIt("creates an overdue CSV artifact and enqueues report-generate", requestOverdueCsv);

  databaseIt("returns queued status from getArtifact before worker completion", getQueuedArtifact);

  databaseIt("rejects teacher overdue CSV requests with FORBIDDEN", teacherDeniedOverdueCsv);

  databaseIt("lets a teacher request a roster for an owned class", teacherRequestsOwnedRoster);
});

async function requestOverdueCsv(): Promise<void> {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { queue, calls } = recordingReportGenerateQueue("job-db");

  const result = await caller({ queue }).reports.requestOverdueCsv({});

  const artifact = await db.generatedArtifact.findUniqueOrThrow({ where: { id: result.artifactId } });

  assert.equal(result.jobId, `job-db:${result.artifactId}`);
  assert.equal(artifact.kind, "OVERDUE_RECEIVABLES_CSV");
  assert.equal(artifact.requestedById, ADMIN.id);
  assert.equal(artifact.completedAt, null);
  assert.deepEqual(calls, [{ artifactId: result.artifactId }]);
}

async function getQueuedArtifact(): Promise<void> {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { studentId } = await seedStudent();
  const created = await caller().reports.requestStudentStatement({ studentId });
  const artifact = await caller().reports.getArtifact({ id: created.artifactId });

  assert.equal(artifact.status, "queued");
  assert.equal(artifact.studentId, studentId);
  assert.equal(artifact.completedAt, null);
}

async function teacherDeniedOverdueCsv(): Promise<void> {
  await cleanReportsDatabase();
  await assert.rejects(
    caller({ staffUser: TEACHER }).reports.requestOverdueCsv({}),
    (error: unknown) => error instanceof TRPCError && error.code === "FORBIDDEN",
  );
}

async function teacherRequestsOwnedRoster(): Promise<void> {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { classId } = await seedOwnedClass();
  const result = await caller({ staffUser: TEACHER }).reports.requestClassRoster({ classId });

  const artifact = await db.generatedArtifact.findUniqueOrThrow({ where: { id: result.artifactId } });

  assert.equal(artifact.kind, "CLASS_ROSTER_PDF");
  assert.equal(artifact.classId, classId);
}
