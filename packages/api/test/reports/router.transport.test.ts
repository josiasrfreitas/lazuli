import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import { db } from "@lazuli/db";

import {
  callHttpMutation,
  callHttpQuery,
  cleanReportsDatabase,
  ensureAdminUser,
  HTTP_OK,
  recordingReportGenerateQueue,
  seedStudent,
} from "../support/reports-test-support.js";

void before(async () => {
  await db.$connect();
});

void after(async () => {
  await cleanReportsDatabase();
  await db.$disconnect();
});

void it("requests a student statement through the HTTP adapter", async () => {
  await cleanReportsDatabase();
  await ensureAdminUser();
  const { studentId } = await seedStudent();
  const { queue, calls } = recordingReportGenerateQueue("job-http");

  const response = await callHttpMutation({
    path: "reports.requestStudentStatement",
    body: { studentId },
    queue,
  });

  assert.equal(response.status, HTTP_OK);
  const payload = (await response.json()) as {
    result: { data: { json: { artifactId: string; jobId: string } } };
  };
  const artifactId = payload.result.data.json.artifactId;

  assert.equal(payload.result.data.json.jobId, `job-http:${artifactId}`);
  assert.deepEqual(calls, [{ artifactId }]);

  const queryResponse = await callHttpQuery({
    path: "reports.getArtifact",
    body: { id: artifactId },
  });

  assert.equal(queryResponse.status, HTTP_OK);
  const queryPayload = (await queryResponse.json()) as {
    result: { data: { json: { status: string; studentId: string } } };
  };

  assert.equal(queryPayload.result.data.json.status, "queued");
  assert.equal(queryPayload.result.data.json.studentId, studentId);
});
