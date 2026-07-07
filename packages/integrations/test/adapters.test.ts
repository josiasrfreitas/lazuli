import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArtifactStorageNotConfiguredError,
  createNoOpArtifactStorage,
  createNoOpEmailSender,
} from "../src/index.js";

void describe("createNoOpEmailSender", () => {
  void it("resolves immediately without network", async () => {
    await assert.doesNotReject(() =>
      createNoOpEmailSender().send({
        to: "admin@example.com",
        subject: "probe",
        html: "<p>probe</p>",
      }),
    );
  });
});

void describe("createNoOpArtifactStorage", () => {
  void it("returns a stub object key on put", async () => {
    const storage = createNoOpArtifactStorage();
    const result = await storage.put({
      key: "reports/probe.csv",
      contentType: "text/csv",
      body: new Uint8Array([1, 2, 3]),
    });

    assert.equal(result.bucket, "local-stub");
    assert.equal(result.key, "reports/probe.csv");
  });

  void it("rejects signed URLs as not configured", async () => {
    await assert.rejects(
      createNoOpArtifactStorage().getSignedUrl("reports/probe.csv"),
      (error: unknown) => error instanceof ArtifactStorageNotConfiguredError,
    );
  });
});
