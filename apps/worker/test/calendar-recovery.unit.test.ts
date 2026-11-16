import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverCalendarRequests } from "@lazuli/worker-handlers/calendar";

void test("daily recovery attempts every request even when the first one fails", async () => {
  const attempted: string[] = [];
  await assert.rejects(
    recoverCalendarRequests({
      requests: [{ id: "first" }, { id: "second" }],
      process: (id) => {
        attempted.push(id);
        if (id === "first") return Promise.reject(new Error("DB_UNAVAILABLE"));
        return Promise.resolve(null);
      },
    }),
    /CALENDAR_RECOVERY_FAILED/u,
  );
  assert.deepEqual(attempted, ["first", "second"]);
});
