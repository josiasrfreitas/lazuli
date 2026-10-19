import assert from "node:assert/strict";
import { it } from "node:test";
import { materialReminderState, stageMaterialAttention } from "../src/material-reminder.js";
void it("shows attention only within thirty civil days of the academic plan end", () => {
  assert.equal(materialReminderState(null, "2026-10-19"), null);
  assert.equal(materialReminderState("2026-11-19", "2026-10-19"), null);
  assert.equal(materialReminderState("2026-11-18", "2026-10-19"), "soon");
  assert.equal(materialReminderState("2026-10-19", "2026-10-19"), "due");
  assert.equal(materialReminderState("2026-10-18", "2026-10-19"), "due");
});
void it("does not ask to buy a book already included, or when staying in the same stage", () => {
  const base = {
    asOf: "2026-10-19",
    plannedEndOn: "2026-10-31",
    currentStageId: "E1",
    nextStageId: "E2",
    acquiredStageIds: ["E1"],
  };
  assert.deepEqual(stageMaterialAttention(base), { timing: "soon", stagePending: false });
  assert.equal(stageMaterialAttention({ ...base, acquiredStageIds: ["E1", "E2", "T1"] }), null);
  assert.equal(stageMaterialAttention({ ...base, nextStageId: "E1" }), null);
  assert.deepEqual(stageMaterialAttention({ ...base, nextStageId: null }), {
    timing: "soon",
    stagePending: true,
  });
  assert.equal(stageMaterialAttention({ ...base, plannedEndOn: null }), null);
});
