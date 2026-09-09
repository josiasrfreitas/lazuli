import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findNextStageInTrack } from "../src/stage-sequence.js";
import type { StageInTrack } from "../src/stage-sequence.js";

const STAGES: StageInTrack[] = [
  { id: "a", internalCode: "TE1", sequence: 1 },
  { id: "b", internalCode: "TE2", sequence: 2 },
  { id: "c", internalCode: "TUI", sequence: 3 },
];

void describe("findNextStageInTrack", () => {
  void it("returns the stage with sequence plus one", () => {
    const next = findNextStageInTrack({
      stages: STAGES,
      currentStageId: "b",
    });

    assert.deepEqual(next, { id: "c", internalCode: "TUI", sequence: 3 });
  });

  void it("returns null at the end of the track", () => {
    const next = findNextStageInTrack({
      stages: STAGES,
      currentStageId: "c",
    });

    assert.equal(next, null);
  });

  void it("returns null when the current stage ID is absent from an empty track", () => {
    const next = findNextStageInTrack({
      stages: [],
      currentStageId: "missing",
    });

    assert.equal(next, null);
  });
});
