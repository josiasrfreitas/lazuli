import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArtifactStorageNotConfiguredError,
  createNoOpArtifactStorage,
  createNoOpEmailSender,
} from "../src/index.js";

const STUB_OBJECT_KEY = "reports/probe.csv";
const STUB_BODY = new TextEncoder().encode("csv");

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
      key: STUB_OBJECT_KEY,
      contentType: "text/csv",
      body: STUB_BODY,
    });

    assert.equal(result.bucket, "local-stub");
    assert.equal(result.key, STUB_OBJECT_KEY);
  });

  void it("rejects signed URLs as not configured", async () => {
    await assert.rejects(
      createNoOpArtifactStorage().getSignedUrl(STUB_OBJECT_KEY),
      (error: unknown) => error instanceof ArtifactStorageNotConfiguredError,
    );
  });
});
