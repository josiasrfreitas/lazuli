import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { afterEach, it } from "node:test";
import { createServiceLogger, reportError, safeError, setErrorReporter } from "../src/index.js";

afterEach(() => setErrorReporter(undefined));

void it("reports the original error and cause instead of the catch log message, without leaking it into logs", () => {
  const output = new PassThrough();
  let logged = "";
  output.on("data", (chunk: Buffer) => {
    logged += chunk.toString();
  });
  const cause = new TypeError("Source parser failed at the original operation");
  const error = new Error("Document processing failed", { cause });
  const received: Error[] = [];
  setErrorReporter((failure) => {
    received.push(failure);
  });
  const logger = createServiceLogger("worker", { destination: output, level: "debug" });
  logger.child({ job_name: "document" }).error({ ...safeError(error) }, "Generic catch label");
  assert.equal(received.length, 1);
  assert.equal(received[0], error);
  assert.equal(received[0]?.cause, cause);
  assert.equal(received[0]?.stack, error.stack);
  assert.doesNotMatch(logged, /Document processing failed|Source parser failed/u);
});

void it("deduplicates the same exception through checkpoints and the request boundary, but not distinct errors", () => {
  const received: Error[] = [];
  setErrorReporter((error) => {
    received.push(error);
  });
  const failure = new RangeError("Cannot schedule this range");
  reportError(failure, { procedure: "calendar.update" });
  reportError(failure, { service: "web" });
  const separate = new RangeError("Cannot schedule this range");
  reportError(separate);
  assert.deepEqual(received, [failure, separate]);
});

void it("preserves the application failure when the monitoring transport fails", () => {
  const failure = new Error("Storage unavailable");
  setErrorReporter(() => {
    throw new Error("Monitoring unavailable");
  });
  reportError(failure);
  assert.equal(failure.message, "Storage unavailable");
  assert.equal(failure.cause, undefined);
});

void it("does not report expected rejections logged below the error level", () => {
  const received: Error[] = [];
  setErrorReporter((error) => {
    received.push(error);
  });
  const logger = createServiceLogger("web", { destination: new PassThrough(), level: "debug" });
  logger.warn({ ...safeError(new Error("Access denied")) }, "Operation rejected");
  assert.deepEqual(received, []);
});
