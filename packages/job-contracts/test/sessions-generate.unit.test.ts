import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enqueueSessionsGenerate,
  SESSIONS_GENERATE_WORKFLOW,
  type SessionsGeneratePayload,
  type SessionsGenerateQueue,
} from "../src/index.js";

const CLASS_ID = "00000000-0000-0000-0000-000000000065";
const SEMESTER_ID = "00000000-0000-0000-0000-000000000066";

void describe("sessions-generate contract", () => {
  void it("enqueues a class-scoped payload", async () => {
    const calls: SessionsGeneratePayload[] = [];
    const queue: SessionsGenerateQueue = {
      enqueueSessionsGenerate: (payload) => {
        calls.push(payload);
        return Promise.resolve({
          workflowName: SESSIONS_GENERATE_WORKFLOW,
          jobId: "job-1",
          payload,
        });
      },
    };

    const result = await enqueueSessionsGenerate({ queue, payload: { classId: CLASS_ID } });

    assert.deepEqual(calls, [{ classId: CLASS_ID }]);
    assert.equal(result.workflowName, "sessions-generate");
    assert.equal(result.jobId, "job-1");
  });

  void it("rejects ambiguous scope", async () => {
    await assert.rejects(
      enqueueSessionsGenerate({
        queue: {
          enqueueSessionsGenerate: () => {
            throw new Error("should not enqueue");
          },
        },
        payload: { classId: CLASS_ID, semesterId: SEMESTER_ID },
      }),
      /Informe classId ou semesterId/,
    );
  });
});
