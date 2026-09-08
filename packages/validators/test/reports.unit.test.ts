import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveArtifactStatus } from "../src/reports.js";

void describe("deriveArtifactStatus", () => {
  void it("returns queued when only requestedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({ startedAt: null, completedAt: null, failedAt: null }),
      "queued",
    );
  });

  void it("returns running when startedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: null,
        failedAt: null,
      }),
      "running",
    );
  });

  void it("returns ready when completedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: new Date(),
        failedAt: null,
      }),
      "ready",
    );
  });

  void it("returns failed when failedAt is set", () => {
    assert.equal(
      deriveArtifactStatus({
        startedAt: new Date(),
        completedAt: null,
        failedAt: new Date(),
      }),
      "failed",
    );
  });
});
