import assert from "node:assert/strict";
import { it } from "node:test";
import { createCaller } from "@lazuli/api";
import { activityPeriodStart } from "../../src/activity/read.js";
import { contextFor, TEACHER_FIXTURE } from "../support/support.js";

void it("uses São Paulo midnight for the day and a seven-civil-day window", () => {
  const instant = new Date("2026-10-11T02:30:00Z");
  assert.equal(activityPeriodStart("TODAY", instant)?.toISOString(), "2026-10-10T03:00:00.000Z");
  assert.equal(activityPeriodStart("7", instant)?.toISOString(), "2026-10-04T03:00:00.000Z");
  assert.equal(activityPeriodStart("ALL", instant), undefined);
});
void it("limits the school-wide log and its author directory to administration", async () => {
  for (const staff of [null, TEACHER_FIXTURE]) {
    const caller = createCaller(contextFor(staff));
    const code = staff ? "FORBIDDEN" : "UNAUTHORIZED";
    await assert.rejects(caller.activity.list({}), { code });
    await assert.rejects(caller.activity.actors(), { code });
  }
});
