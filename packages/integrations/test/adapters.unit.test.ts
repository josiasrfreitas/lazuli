import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ArtifactStorageNotConfiguredError, createNoOpArtifactStorage } from "../src/index.js";

const STUB_OBJECT_KEY = "reports/probe.csv";

void describe("createNoOpArtifactStorage", () => {
  void it("rejects signed URLs as not configured", async () => {
    let error!: Error;
    await assert.rejects(
      createNoOpArtifactStorage().getSignedUrl(STUB_OBJECT_KEY),
      (candidate: unknown) => {
        error = candidate as Error;
        return candidate instanceof ArtifactStorageNotConfiguredError;
      },
    );

    assert.equal(error.message, "NOT_CONFIGURED");
    assert.equal(error.name, "ArtifactStorageNotConfiguredError");
  });
});
