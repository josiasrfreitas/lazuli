import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import type { Logger } from "pino";

import {
  createServiceLogger,
  requestIdFromHeaders,
  safeError,
  withCheckpoint,
} from "../src/index.js";

type LogLine = {
  level?: string;
  service_name?: string;
  message?: string;
  request_id?: string;
  user_id?: string;
  password?: string;
  timestamp?: string;
  checkpoint?: string;
  status?: string;
  duration_ms?: number;
};

function capturedLogger(): { logger: Logger; lines: LogLine[] } {
  const destination = new PassThrough();
  const lines: LogLine[] = [];
  destination.on("data", (chunk: Buffer) => {
    lines.push(JSON.parse(chunk.toString()) as LogLine);
  });
  return { logger: createServiceLogger("web", { destination, level: "info" }), lines };
}

void describe("structured logging", () => {
  void it("writes UTC JSON with a request ID and masks sensitive fields", () => {
    const { logger, lines } = capturedLogger();
    const requestId = requestIdFromHeaders(new Headers());
    logger.info({ request_id: requestId, password: "secret", user_id: "staff-1" }, "Ready");

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.level, "INFO");
    assert.equal(lines[0]?.service_name, "web");
    assert.equal(lines[0]?.message, "Ready");
    assert.equal(lines[0]?.request_id, requestId);
    assert.equal(lines[0]?.user_id, "staff-1");
    assert.equal(lines[0]?.password, "[REDACTED]");
    assert.match(String(lines[0]?.timestamp), /^\d{4}-\d\d-\d\dT.*Z$/u);
  });

  void it("accepts only UUID request IDs and keeps error messages out of stacks", () => {
    const valid = "b2e4a8f3-6f15-4d3a-a10f-c8bc8c1d9333";
    assert.equal(requestIdFromHeaders(new Headers({ "x-request-id": valid })), valid);
    assert.notEqual(
      requestIdFromHeaders(new Headers({ "x-request-id": "attacker-input" })),
      "attacker-input",
    );

    const error = new Error("student@example.com");
    const fields = safeError(error);
    assert.equal(fields.error_name, "Error");
    assert.ok(fields.error_stack?.includes("at "));
    assert.ok(!JSON.stringify(fields).includes("student@example.com"));
  });

  void it("records failed checkpoints and rethrows the original error", async () => {
    const { logger, lines } = capturedLogger();
    const failure = new Error("private value");
    await assert.rejects(
      withCheckpoint(logger, { checkpoint: "load", action: () => Promise.reject(failure) }),
      (error) => error === failure,
    );
    assert.equal(lines[0]?.checkpoint, "load");
    assert.equal(lines[0]?.status, "error");
    assert.equal(lines[0]?.level, "ERROR");
    assert.equal(typeof lines[0]?.duration_ms, "number");
    assert.ok(!JSON.stringify(lines[0]).includes("private value"));
  });
});
