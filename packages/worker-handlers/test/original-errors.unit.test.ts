import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { setErrorReporter } from "@lazuli/logging";
import type { DatabaseClient } from "@lazuli/db";
import { processSessionGeneration } from "../src/sessions/process-generation.js";

afterEach(() => setErrorReporter(undefined));
void it("retains the original database exception and trace after recording a failed generation", async () => {
  const source = new TypeError("Generation database connection interrupted");
  const captured: Error[] = [];
  const writes: object[] = [];
  setErrorReporter((error) => {
    captured.push(error);
  });
  const database = {
    sessionGenerationRequest: {
      findFirst: () => Promise.reject(source),
      updateMany: (input: object) => {
        writes.push(input);
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as DatabaseClient;
  await assert.rejects(
    processSessionGeneration({
      database,
      payload: {
        classId: "d1f5fc68-bf66-41c5-bb1a-066ea21db64e",
        requestId: "578efb47-f19a-4428-8300-893d57a100cb",
      },
    }),
    (error) => error === source,
  );
  assert.deepEqual(captured, [source]);
  assert.equal(captured[0]?.stack, source.stack);
  assert.equal(writes.length, 1);
});
