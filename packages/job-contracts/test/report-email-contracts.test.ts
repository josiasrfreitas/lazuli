import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLocalEmailOverdueD30Queue,
  createLocalEmailOverdueDigestQueue,
  createLocalEmailPortalFailureQueue,
  createLocalReportGenerateQueue,
  EMAIL_OVERDUE_D30_WORKFLOW,
  EMAIL_OVERDUE_DIGEST_WORKFLOW,
  EMAIL_PORTAL_FAILURE_WORKFLOW,
  enqueueEmailOverdueD30,
  enqueueEmailOverdueDigest,
  enqueueEmailPortalFailure,
  enqueueReportGenerate,
  REPORT_GENERATE_WORKFLOW,
} from "../src/index.js";

const ARTIFACT_ID = "00000000-0000-0000-0000-000000000066";
const PORTAL_RUN_ID = "00000000-0000-0000-0000-000000000067";
const INSTALLMENT_ID = "00000000-0000-0000-0000-000000000068";

void describe("report-generate contract", () => {
  void it("enqueues an artifact-scoped payload", async () => {
    const queue = createLocalReportGenerateQueue();
    const result = await enqueueReportGenerate({ queue, payload: { artifactId: ARTIFACT_ID } });

    assert.equal(result.workflowName, REPORT_GENERATE_WORKFLOW);
    assert.equal(result.jobId, `${REPORT_GENERATE_WORKFLOW}:${ARTIFACT_ID}`);
    assert.deepEqual(result.payload, { artifactId: ARTIFACT_ID });
  });
});

void describe("email-portal-failure contract", () => {
  void it("enqueues a portal run id", async () => {
    const queue = createLocalEmailPortalFailureQueue();
    const result = await enqueueEmailPortalFailure({
      queue,
      payload: { portalRunId: PORTAL_RUN_ID },
    });

    assert.equal(result.workflowName, EMAIL_PORTAL_FAILURE_WORKFLOW);
    assert.equal(result.jobId, `${EMAIL_PORTAL_FAILURE_WORKFLOW}:${PORTAL_RUN_ID}`);
  });
});

void describe("email-overdue-digest contract", () => {
  void it("enqueues an empty payload", async () => {
    const queue = createLocalEmailOverdueDigestQueue();
    const result = await enqueueEmailOverdueDigest({ queue, payload: {} });

    assert.equal(result.workflowName, EMAIL_OVERDUE_DIGEST_WORKFLOW);
    assert.deepEqual(result.payload, {});
  });
});

void describe("email-overdue-d30 contract", () => {
  void it("enqueues an installment id", async () => {
    const queue = createLocalEmailOverdueD30Queue();
    const result = await enqueueEmailOverdueD30({
      queue,
      payload: { installmentId: INSTALLMENT_ID },
    });

    assert.equal(result.workflowName, EMAIL_OVERDUE_D30_WORKFLOW);
    assert.equal(result.jobId, `${EMAIL_OVERDUE_D30_WORKFLOW}:${INSTALLMENT_ID}`);
  });
});
