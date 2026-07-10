import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { createArtifactStorageFromEnv, parseStorageEnvironment } from "../../src/index.js";

const environment = parseStorageEnvironment();

void describe("GCS artifact storage against fake-gcs-server", () => {
  void it("puts an object and serves it back through the signed URL", async () => {
    assert.notEqual(environment.gcsArtifactsBucket, undefined);
    assert.notEqual(environment.storageEmulatorHost, undefined);

    const storage = createArtifactStorageFromEnv();
    const key = `reports/test-${randomUUID()}/probe.csv`;
    const body = `col\né pt-BR ${randomUUID()}\r\n`;

    const putResult = await storage.put({
      key,
      contentType: "text/csv; charset=utf-8",
      body: new TextEncoder().encode(body),
    });

    assert.equal(putResult.bucket, environment.gcsArtifactsBucket);
    assert.equal(putResult.key, key);

    const signedUrl = await storage.getSignedUrl(key);
    const response = await fetch(signedUrl);

    assert.equal(response.ok, true);
    assert.equal(await response.text(), body);
  });
});
