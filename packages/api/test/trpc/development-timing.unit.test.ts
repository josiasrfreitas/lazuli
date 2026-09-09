import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseTrpcDevelopmentDelay,
  withDevelopmentTiming,
} from "../../src/trpc/development-timing.js";

void describe("TRPC development timing", () => {
  void it("disables delay when the setting is absent", async () => {
    const events: string[] = [];

    const result = await runTiming(parseTrpcDevelopmentDelay(), events);

    assert.equal(result, "result");
    assert.deepEqual(events, ["next"]);
  });

  void it("disables delay and timing log when the setting is zero", async () => {
    const events: string[] = [];

    await runTiming(parseTrpcDevelopmentDelay("0"), events);

    assert.deepEqual(events, ["next"]);
  });

  void it("applies the configured fixed delay and enables the duration log", async () => {
    const events: string[] = [];

    await runTiming(parseTrpcDevelopmentDelay("125"), events);

    assert.deepEqual(events, ["sleep:125", "next", "log:[TRPC] students.list took 9ms\n"]);
  });

  void it("rejects a value that is not a non-negative integer", () => {
    assert.throws(() => parseTrpcDevelopmentDelay("-1"), /non-negative integer/u);
    assert.throws(() => parseTrpcDevelopmentDelay("1.5"), /non-negative integer/u);
    assert.throws(
      () => parseTrpcDevelopmentDelay("999999999999999999999999999999"),
      /non-negative integer/u,
    );
  });
});

async function runTiming(delayMs: number, events: string[]): Promise<string> {
  const startTime = 10;
  const endTime = 19;
  const times = [startTime, endTime];
  return await withDevelopmentTiming({
    delayMs,
    log: (message) => events.push(`log:${message}`),
    next: () => {
      events.push("next");
      return Promise.resolve("result");
    },
    now: () => times.shift() ?? endTime,
    path: "students.list",
    sleep: (milliseconds) => {
      events.push(`sleep:${milliseconds}`);
      return Promise.resolve();
    },
  });
}
