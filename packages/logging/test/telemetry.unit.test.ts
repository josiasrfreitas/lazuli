import assert from "node:assert/strict";
import { it } from "node:test";
import { sanitizeTelemetry, sentryOptions, telemetryEnabled } from "../src/telemetry.js";

void it("sends automatically only in prod and allows an explicit local verification", () => {
  for (const environment of [undefined, "development", "test", "staging", "production"]) {
    assert.equal(telemetryEnabled(environment), false, String(environment));
  }
  assert.equal(telemetryEnabled("prod"), true);
  assert.equal(telemetryEnabled("development", "1"), true);
  assert.equal(sentryOptions({ environment: "prod" }).enabled, false);
  assert.equal(
    sentryOptions({ environment: "prod", dsn: "https://public@example.invalid/1" }).enabled,
    true,
  );
  assert.equal(sentryOptions({ verification: "1" }).environment, "verification");
});

void it("preserves the exact diagnostic and source frames while removing private context", () => {
  const event = sanitizeTelemetry({
    exception: {
      values: [
        {
          type: "TypeError",
          value: "Cannot read the schedule revision",
          stacktrace: {
            frames: [
              {
                filename: "packages/domain/src/program-schedule.ts",
                lineno: 42,
                function: "scheduleProgram",
                vars: { student: "private" },
              },
            ],
          },
        },
      ],
    },
    user: { email: "student@example.com" },
    request: {
      url: "https://school.invalid/api/trpc?input=private",
      method: "POST",
      data: "private",
      headers: { authorization: "secret" },
    },
    extra: { content: "private" },
    breadcrumbs: [{ message: "private" }],
  });
  const exception = event.exception.values[0];
  assert.ok(exception);
  const frame = exception.stacktrace.frames[0];
  assert.ok(frame);
  assert.equal(exception.value, "Cannot read the schedule revision");
  assert.equal(frame.lineno, 42);
  assert.equal(frame.filename, "packages/domain/src/program-schedule.ts");
  assert.deepEqual(event.request, { url: "https://school.invalid/api/trpc", method: "POST" });
  assert.equal(event.user, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.breadcrumbs, undefined);
  assert.equal(frame.vars, undefined);
});
